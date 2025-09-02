<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { toast } from 'svelte-sonner';
	import jsQR from 'jsqr';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';

	import {
		IconCamera,
		IconCameraOff,
		IconReload,
		IconAlertTriangle,
		IconCheck,
		IconQrcode,
		IconX,
		IconUser,
		IconClock
	} from '@tabler/icons-svelte';

	// Types
	interface ScanResult {
		success: boolean;
		message: string;
		user_name?: string;
		student_id?: string;
		participation_status?: string;
		checked_in_at?: string;
	}

	interface ScannedUser {
		user_name: string;
		student_id: string;
		participation_status: string;
		checked_in_at: string;
		timestamp: number;
	}

	// Props
	let {
		activity_id = '',
		isActive = false,
		showHistory = true,
		maxHistoryItems = 10,
		onScan = undefined,
		onError = undefined,
		onStatusChange = undefined
	}: {
		activity_id?: string;
		isActive?: boolean;
		showHistory?: boolean;
		maxHistoryItems?: number;
		onScan?: ((result: ScanResult, qrData: string) => void) | undefined;
		onError?: ((message: string) => void) | undefined;
		onStatusChange?: ((status: 'idle' | 'requesting' | 'active' | 'error') => void) | undefined;
	} = $props();

	// Component state
	let videoElement = $state<HTMLVideoElement>();
	let stream = $state<MediaStream | null>(null);
	let isScanning = $state(false);
	let error = $state<string | null>(null);
	let lastScanTime = 0;
	let scanCooldown = 2000; // 2 seconds between scans

	// Debouncing and cleanup state
	let cameraRequestInProgress = $state(false);
	let retryCount = $state(0);
	let maxRetries = 3;
	let retryDelay = 1000; // Start with 1 second
	let cleanupPromise: Promise<void> | null = null;

	let debugInfo = $state({
		hasCamera: false,
		cameraPermission: 'unknown',
		videoReady: false,
		streamActive: false,
		deviceOrientation: 'unknown'
	});

	// QR Code validation state
	let invalidScansCount = $state(0);
	let lastInvalidScanTime = 0;
	let recentScannedCodes = new Set<string>();

	// Scanner state
	let cameraStatus = $state<'idle' | 'requesting' | 'active' | 'error'>('idle');
	let scanHistory = $state<ScannedUser[]>([]);
	let isProcessingScan = $state(false);

	// Scan mode: check-in or check-out
	let scanMode = $state<'checkin' | 'checkout'>('checkin');

	// Reactive effect
	$effect(() => {
		if (browser && isActive && activity_id && cameraStatus === 'idle') {
			console.log('Effect: Starting camera due to state change');
			// Small delay to ensure DOM is ready
			setTimeout(() => {
				if (cameraStatus === 'idle') {
					// Check again in case status changed
					startCamera();
				}
			}, 100);
		} else if (browser && !isActive && cameraStatus !== 'idle') {
			console.log('Effect: Stopping camera due to state change');
			stopCamera();
		}
	});

	onMount(async () => {
		console.log('onMount: Component mounted', { isActive, activity_id, cameraStatus });

		if (browser) {
			// Check camera availability
			debugInfo.hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

			// Check camera permission if available
			if (navigator.permissions) {
				try {
					const permissionStatus = await navigator.permissions.query({
						name: 'camera' as PermissionName
					});
					debugInfo.cameraPermission = permissionStatus.state;
				} catch (e) {
					console.log('Cannot check camera permission:', e);
				}
			}

			// Set up orientation detection
			setupOrientationDetection();

			if (isActive && activity_id && cameraStatus === 'idle') {
				console.log('onMount: Starting camera');
				startCamera();
			}
		}
	});

	onDestroy(() => {
		stopCamera();
	});

	async function startCamera() {
		if (!browser || !activity_id) {
			console.log('startCamera: browser or activity_id not available');
			return;
		}

		// Prevent multiple simultaneous calls
		if (cameraStatus === 'requesting' || cameraStatus === 'active') {
			console.log('startCamera: Camera already starting/active, skipping');
			return;
		}

		console.log('startCamera: Starting camera...');

		// Check if getUserMedia is supported
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			const errorMsg = 'เบราว์เซอร์นี้ไม่รองรับการเข้าถึงกล้อง';
			handleCameraError(errorMsg);
			return;
		}

		// Ensure any existing stream is completely stopped before starting new one
		await ensureStreamCleanup();

		cameraStatus = 'requesting';
		error = null;
		onStatusChange?.(cameraStatus);

		try {
			// Get camera stream with retry mechanism
			stream = await getCameraStreamWithRetry();
			console.log('Camera stream obtained successfully:', stream);

			console.log('Checking video element and stream:', {
				hasVideoElement: !!videoElement,
				hasStream: !!stream,
				videoElementTagName: videoElement?.tagName,
				streamId: stream?.id
			});

			if (!videoElement) {
				console.error('Video element not available, waiting for DOM...');
				// Wait for video element to be available in DOM
				await new Promise((resolve) => {
					const checkElement = () => {
						// Try to find video element in DOM
						const domVideoElement = document.querySelector('#video-container video');
						console.log('Checking for video element in DOM:', {
							domVideoElement: !!domVideoElement,
							bindVideoElement: !!videoElement,
							domElementTag: domVideoElement?.tagName
						});

						if (domVideoElement) {
							console.log('Video element found in DOM, binding...');
							videoElement = domVideoElement as HTMLVideoElement;
							resolve(true);
						} else if (videoElement) {
							console.log('Video element now available via binding');
							resolve(true);
						} else {
							console.log('Video element still not found, retrying...');
							setTimeout(checkElement, 100);
						}
					};
					checkElement();
				});
			}

			if (videoElement && stream) {
				console.log('Setting video stream');
				videoElement.srcObject = stream;

				// Wait for video metadata to load
				await new Promise((resolve, reject) => {
					if (!videoElement) {
						reject(new Error('Video element not available'));
						return;
					}

					const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), 10000);

					const onLoadedMetadata = () => {
						if (!videoElement) return;
						clearTimeout(timeoutId);
						console.log(
							'Video metadata loaded:',
							videoElement.videoWidth,
							'x',
							videoElement.videoHeight
						);
						console.log(
							'Video element dimensions:',
							videoElement.offsetWidth,
							'x',
							videoElement.offsetHeight
						);
						console.log('Video element styles:', window.getComputedStyle(videoElement));
						debugInfo.videoReady = true;
						debugInfo.streamActive = true;
						resolve(true);
					};

					const onVideoError = (e: Event) => {
						clearTimeout(timeoutId);
						console.error('Video error:', e);
						reject(new Error('Video element error'));
					};

					videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
					videoElement.addEventListener('error', onVideoError, { once: true });

					// Also listen for canplay event as backup
					videoElement.addEventListener(
						'canplay',
						() => {
							console.log('Video can start playing');
							debugInfo.videoReady = true;
						},
						{ once: true }
					);
				});

				// Play video with error handling for mobile
				console.log('Starting video playback');

				if (!videoElement) {
					throw new Error('Video element not available for playback');
				}

				try {
					const playPromise = videoElement.play();
					if (playPromise !== undefined) {
						await playPromise;
					}
				} catch (playError) {
					console.warn('Video play failed, trying again:', playError);
					// Sometimes the first play fails, try again after a short delay
					await new Promise((resolve) => setTimeout(resolve, 100));
					if (videoElement) {
						await videoElement.play();
					}
				}

				// Set mobile-specific attributes
				if (videoElement) {
					videoElement.setAttribute('webkit-playsinline', 'true');
					videoElement.setAttribute('data-webkit-playsinline', 'true');

					// Force video visibility and correct sizing
					videoElement.style.visibility = 'visible';
					videoElement.style.opacity = '1';
					videoElement.style.display = 'block';
					videoElement.style.width = '100%';
					videoElement.style.height = '100%';
					videoElement.style.objectFit = 'cover';
					videoElement.style.zIndex = '1';

					// Force a reflow to ensure proper sizing
					videoElement.offsetHeight;
				}

				// Additional checks for video display
				if (videoElement) {
					console.log('Video element computed styles:', {
						display: window.getComputedStyle(videoElement).display,
						visibility: window.getComputedStyle(videoElement).visibility,
						opacity: window.getComputedStyle(videoElement).opacity,
						position: window.getComputedStyle(videoElement).position,
						width: window.getComputedStyle(videoElement).width,
						height: window.getComputedStyle(videoElement).height,
						objectFit: window.getComputedStyle(videoElement).objectFit,
						transform: window.getComputedStyle(videoElement).transform
					});
				}

				// Additional debugging for video display
				setTimeout(() => {
					if (videoElement) {
						console.log('Video final check:', {
							videoWidth: videoElement.videoWidth,
							videoHeight: videoElement.videoHeight,
							offsetWidth: videoElement.offsetWidth,
							offsetHeight: videoElement.offsetHeight,
							clientWidth: videoElement.clientWidth,
							clientHeight: videoElement.clientHeight,
							readyState: videoElement.readyState,
							paused: videoElement.paused,
							srcObject: !!videoElement.srcObject,
							parentElement: !!videoElement.parentElement,
							isConnected: videoElement.isConnected,
							style: videoElement.style.cssText
						});

						// Try to force repaint
						const parent = videoElement.parentElement;
						if (parent) {
							console.log('Parent element info:', {
								offsetWidth: parent.offsetWidth,
								offsetHeight: parent.offsetHeight,
								className: parent.className,
								computedStyle: window.getComputedStyle(parent).cssText
							});

							// Force repaint by temporarily hiding and showing
							parent.style.display = 'none';
							parent.offsetHeight; // Force reflow
							parent.style.display = '';
						}
					}
				}, 1000);

				cameraStatus = 'active';
				isScanning = true;
				debugInfo.streamActive = true;
				console.log('Camera started successfully');

				// Start QR detection after a short delay to ensure video is rendering
				setTimeout(() => {
					startQRDetection();
				}, 500);
			}
		} catch (err) {
			console.error('Failed to start camera:', err);

			// Handle the error with retry logic
			await handleCameraStartError(err as Error);
		}

		cameraRequestInProgress = false;
		onStatusChange?.(cameraStatus);
	}

	function stopCamera() {
		console.log('Stopping camera');

		// Create cleanup promise to track completion
		cleanupPromise = performStreamCleanup();

		// Don't wait for cleanup to complete, but track it
		cleanupPromise.finally(() => {
			cleanupPromise = null;
		});

		isScanning = false;
		cameraStatus = 'idle';
		cameraRequestInProgress = false;
		retryCount = 0;
		error = null;
		onStatusChange?.(cameraStatus);
	}

	/**
	 * Performs thorough stream cleanup
	 */
	async function performStreamCleanup(): Promise<void> {
		console.log('Performing stream cleanup');

		if (stream) {
			try {
				// Stop all tracks with proper error handling
				const tracks = stream.getTracks();
				for (const track of tracks) {
					try {
						console.log('Stopping track:', track.label, 'State:', track.readyState);
						track.stop();

						// Wait for track to actually stop
						let attempts = 0;
						while (track.readyState !== 'ended' && attempts < 10) {
							await new Promise((resolve) => setTimeout(resolve, 10));
							attempts++;
						}

						if (track.readyState !== 'ended') {
							console.warn('Track did not stop properly:', track.label);
						}
					} catch (e) {
						console.warn('Error stopping track:', track.label, e);
					}
				}
			} catch (e) {
				console.warn('Error during track cleanup:', e);
			} finally {
				stream = null;
			}
		}

		if (videoElement) {
			try {
				videoElement.pause();
				videoElement.srcObject = null;

				// Wait a bit for the video element to fully release the stream
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (e) {
				console.warn('Error cleaning up video element:', e);
			}
		}

		debugInfo.streamActive = false;
		debugInfo.videoReady = false;
	}

	/**
	 * Ensures all streams are properly cleaned up before starting new ones
	 */
	async function ensureStreamCleanup(): Promise<void> {
		if (stream || videoElement?.srcObject) {
			console.log('Ensuring complete stream cleanup before new camera start');
			await performStreamCleanup();

			// Additional safety delay to ensure hardware is released
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}

	async function startQRDetection() {
		if (!isScanning || !videoElement || cameraStatus !== 'active') return;

		try {
			// Use HTML5 QRCode library or create canvas-based detection
			await detectQRCode();
		} catch (err) {
			console.error('QR Detection error:', err);
		}

		// Continue scanning
		if (isScanning) {
			requestAnimationFrame(startQRDetection);
		}
	}

	async function detectQRCode() {
		if (!videoElement || isProcessingScan) return;

		// Check if video is ready
		if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
			return; // Video not ready yet
		}

		// Create canvas to capture video frame
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		if (!ctx) return;

		canvas.width = videoElement.videoWidth;
		canvas.height = videoElement.videoHeight;

		// Draw video frame normally (no flipping)
		ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

		// Get image data
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

		// Use jsQR library for QR code detection
		try {
			await handleQRDetection(imageData);
		} catch (err) {
			console.error('QR Code detection error:', err);
		}
	}

	async function handleQRDetection(imageData: ImageData) {
		// Use jsQR to detect QR codes in the image data
		try {
			const code = jsQR(imageData.data, imageData.width, imageData.height, {
				inversionAttempts: 'attemptBoth'
			});

			if (code) {
				// Check scan cooldown
				const now = Date.now();
				if (now - lastScanTime < scanCooldown) return;

				// Validate that this is actually a proper QR code for our system
				if (isValidQRCode(code.data)) {
					// Found valid QR code, process it
					await processQRCode(code.data);
				} else {
					// Invalid QR code or barcode detected
					handleInvalidCode(code.data, now);
				}
			}
		} catch (err) {
			console.error('jsQR detection error:', err);
		}
	}

	async function processQRCode(qrData: string) {
		if (isProcessingScan) return;

		isProcessingScan = true;
		const now = Date.now();

		// Check cooldown
		if (now - lastScanTime < scanCooldown) {
			isProcessingScan = false;
			return;
		}

		lastScanTime = now;

		try {
			// Double-check QR code validity before sending to server
			if (!isValidQRCode(qrData)) {
				const errorMessage = 'รูปแบบ QR Code ไม่ถูกต้อง';
				toast.error(errorMessage);
				onError?.(errorMessage);
				return;
			}

			const response = await fetch(`/api/activities/${activity_id}/${scanMode}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ qr_data: qrData })
			});

			const result = await response.json();

			if (response.ok && result.success === true) {
				const scanResult: ScanResult = {
					success: true,
					message: result.message || 'สแกนสำเร็จ',
					user_name: result.data?.user_name,
					student_id: result.data?.student_id,
					participation_status: result.data?.participation_status,
					checked_in_at: result.data?.checked_in_at || result.data?.checked_out_at
				};

				// Add to history
				if (scanResult.user_name && scanResult.student_id) {
					const historyItem: ScannedUser = {
						user_name: scanResult.user_name,
						student_id: scanResult.student_id,
						participation_status:
							scanResult.participation_status ||
							(scanMode === 'checkin' ? 'checked_in' : 'checked_out'),
						checked_in_at: scanResult.checked_in_at || new Date().toISOString(),
						timestamp: now
					};

					scanHistory = [historyItem, ...scanHistory.slice(0, maxHistoryItems - 1)];
				}

				toast.success(`สแกนสำเร็จ: ${scanResult.user_name}`);
				onScan?.(scanResult, qrData);
			} else {
				const scanResult: ScanResult = {
					success: false,
					message: result.message || 'เกิดข้อผิดพลาดในการสแกน'
				};

				toast.error(scanResult.message);
				onScan?.(scanResult, qrData);
			}
		} catch (err) {
			console.error('Scan processing error:', err);
			const errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			toast.error(errorMessage);
			onError?.(errorMessage);
		} finally {
			isProcessingScan = false;
		}
	}

	// Manual scan trigger for testing/accessibility
	async function triggerManualScan() {
		// In development or for testing, allow manual QR data input
		const qrData = prompt('กรุณาป้อน QR Data สำหรับทดสอบ:');
		if (qrData) {
			await processQRCode(qrData);
		}
	}

	function clearHistory() {
		scanHistory = [];
		toast.success('ล้างประวัติการสแกนเรียบร้อย');
	}

	function formatDateTime(dateString: string): string {
		try {
			const date = new Date(dateString);
			return date.toLocaleString('th-TH', {
				year: '2-digit',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'ไม่ระบุ';
		}
	}

	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status.toLowerCase()) {
			case 'checked_in':
			case 'checkedin':
				return 'default';
			case 'checked_out':
			case 'checkedout':
				return 'secondary';
			case 'registered':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function getStatusText(status: string): string {
		switch (status.toLowerCase()) {
			case 'checked_in':
			case 'checkedin':
				return 'เข้าร่วมแล้ว';
			case 'checked_out':
			case 'checkedout':
				return 'ออกจากกิจกรรมแล้ว';
			case 'registered':
				return 'ลงทะเบียนแล้ว';
			default:
				return status;
		}
	}

	// QR Code validation function
	function isValidQRCode(qrData: string): boolean {
		if (!qrData || typeof qrData !== 'string') {
			return false;
		}

		// Check if it's too short to be a valid QR code
		if (qrData.length < 10) {
			return false;
		}

		// Try to parse as Base64 encoded JSON (our expected format)
		try {
			// Use atob for browser compatibility instead of Buffer
			const decoded =
				typeof window !== 'undefined'
					? atob(qrData)
					: Buffer.from(qrData, 'base64').toString('utf-8');
			const obj = JSON.parse(decoded);
			// Check if it has required fields
			if (obj && typeof obj === 'object' && obj.uid) {
				return true;
			}
		} catch {
			// Try parsing as direct JSON
			try {
				const obj = JSON.parse(qrData);
				if (obj && typeof obj === 'object' && obj.uid) {
					return true;
				}
			} catch {
				// Not valid JSON
			}
		}

		// Check for common barcode patterns that are NOT QR codes
		if (isLikelyBarcode(qrData)) {
			return false;
		}

		return false;
	}

	// Function to detect common barcode patterns
	function isLikelyBarcode(data: string): boolean {
		// Common barcode patterns:
		// 1. Only digits (UPC, EAN)
		if (/^\d+$/.test(data)) {
			return true;
		}

		// 2. Simple alphanumeric patterns without structure
		if (/^[A-Z0-9]+$/.test(data) && data.length < 20) {
			return true;
		}

		// 3. Common barcode prefixes
		const barcodePatterns = [
			/^\d{12,13}$/, // UPC/EAN
			/^[A-Z]{2}\d+$/, // Some product codes
			/^\d{1,4}-\d{4,6}-\d{1,6}$/ // Hyphenated numbers
		];

		return barcodePatterns.some((pattern) => pattern.test(data));
	}

	// Handle invalid codes (barcodes, etc.)
	function handleInvalidCode(data: string, timestamp: number) {
		// Prevent spam of invalid scan notifications
		if (timestamp - lastInvalidScanTime < 3000) {
			return;
		}

		lastInvalidScanTime = timestamp;
		invalidScansCount++;

		// Show a helpful message
		const message = isLikelyBarcode(data)
			? 'ตรวจพบบาร์โค้ด กรุณาสแกน QR Code เท่านั้น'
			: 'รูปแบบ QR Code ไม่ถูกต้อง';

		toast.warning(message);
		console.log('Invalid code detected:', {
			data,
			isLikelyBarcode: isLikelyBarcode(data),
			length: data.length
		});
	}

	// Device orientation detection
	function getDeviceOrientation(): 'portrait' | 'landscape' {
		if (typeof window === 'undefined') return 'portrait';

		// Use screen orientation API if available
		if (screen.orientation) {
			return screen.orientation.angle === 0 || screen.orientation.angle === 180
				? 'portrait'
				: 'landscape';
		}

		// Fallback to window dimensions
		return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
	}

	// Setup orientation change detection
	function setupOrientationDetection() {
		if (typeof window === 'undefined') return;

		debugInfo.deviceOrientation = getDeviceOrientation();

		// Listen for orientation changes
		const handleOrientationChange = () => {
			const newOrientation = getDeviceOrientation();
			if (newOrientation !== debugInfo.deviceOrientation) {
				debugInfo.deviceOrientation = newOrientation;
				console.log('Orientation changed to:', newOrientation);

				// If camera is active, restart it with new constraints
				if (cameraStatus === 'active' && stream) {
					console.log('Restarting camera for orientation change');
					stopCamera();
					setTimeout(() => {
						if (isActive) {
							startCamera();
						}
					}, 500);
				}
			}
		};

		// Listen for both orientationchange and resize
		window.addEventListener('orientationchange', handleOrientationChange);
		window.addEventListener('resize', handleOrientationChange);

		// Clean up listeners on destroy
		return () => {
			window.removeEventListener('orientationchange', handleOrientationChange);
			window.removeEventListener('resize', handleOrientationChange);
		};
	}

	/**
	 * Gets camera stream with retry mechanism for better reliability
	 */
	async function getCameraStreamWithRetry(): Promise<MediaStream> {
		// Get current orientation for camera constraints
		const isPortrait = getDeviceOrientation() === 'portrait';

		// Request camera permissions with orientation-aware constraints
		const constraints = {
			video: {
				facingMode: { ideal: 'environment' }, // Prefer back camera but allow front if needed
				width: isPortrait
					? { min: 320, ideal: 720, max: 1080 }
					: { min: 480, ideal: 1280, max: 1920 },
				height: isPortrait
					? { min: 480, ideal: 1280, max: 1920 }
					: { min: 320, ideal: 720, max: 1080 },
				frameRate: { ideal: 30, max: 60 }
			},
			audio: false
		};

		console.log('Requesting camera with constraints:', constraints);

		// Try with ideal constraints first
		try {
			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			console.log('Camera stream obtained successfully with ideal constraints');
			return stream;
		} catch (error) {
			console.warn('Failed with ideal constraints, trying fallback:', error);

			// Try with fallback constraints if ideal fails
			const fallbackConstraints = {
				video: {
					facingMode: 'environment', // Remove ideal, just prefer back camera
					width: { min: 320, max: 1920 },
					height: { min: 240, max: 1080 }
				},
				audio: false
			};

			try {
				const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
				console.log('Camera stream obtained with fallback constraints');
				return stream;
			} catch (fallbackError) {
				console.warn('Fallback constraints failed, trying minimal:', fallbackError);

				// Last resort - minimal constraints
				const minimalConstraints = {
					video: true,
					audio: false
				};

				const stream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
				console.log('Camera stream obtained with minimal constraints');
				return stream;
			}
		}
	}

	/**
	 * Handles camera start errors with retry logic
	 */
	async function handleCameraStartError(cameraError: Error): Promise<void> {
		console.error('Camera start error:', cameraError);

		const errorObj = cameraError as Error & { name?: string };

		// Check if this is a retryable error
		if (errorObj.name === 'NotReadableError' && retryCount < maxRetries) {
			retryCount++;
			const delay = retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff

			console.log(
				`Camera access failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`
			);

			const retryMessage = `กล้องถูกใช้งาน กำลังลองใหม่... (${retryCount}/${maxRetries})`;
			error = retryMessage;

			// Wait and retry
			setTimeout(async () => {
				if (cameraStatus === 'requesting' && isActive && activity_id) {
					console.log(`Retrying camera start (attempt ${retryCount})`);
					// Reset status to allow retry
					cameraStatus = 'idle';
					cameraRequestInProgress = false;
					await startCamera();
				}
			}, delay);

			return;
		}

		// Non-retryable error or max retries reached
		const errorMessage = getCameraErrorMessage(errorObj);
		handleCameraError(errorMessage);
	}

	/**
	 * Gets user-friendly error message for camera errors
	 */
	function getCameraErrorMessage(error: Error & { name?: string }): string {
		if (error.name === 'NotAllowedError') {
			return 'กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์';
		} else if (error.name === 'NotFoundError') {
			return 'ไม่พบกล้องในอุปกรณ์';
		} else if (error.name === 'NotReadableError') {
			if (retryCount >= maxRetries) {
				return 'กล้องถูกใช้งานโดยแอปพลิเคชันอื่น โปรดปิดแอปอื่นและลองใหม่';
			}
			return 'กล้องถูกใช้งานโดยแอปพลิเคชันอื่น';
		} else if (error.name === 'OverconstrainedError') {
			return 'กล้องไม่รองรับการตั้งค่าที่ต้องการ';
		} else if (error.name === 'SecurityError') {
			return 'การเข้าถึงกล้องถูกบล็อกโดยนโยบายความปลอดภัย';
		} else {
			return `ไม่สามารถเข้าถึงกล้องได้: ${error.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}`;
		}
	}

	/**
	 * Handles camera errors uniformly
	 */
	function handleCameraError(errorMessage: string): void {
		error = errorMessage;
		cameraStatus = 'error';
		cameraRequestInProgress = false;
		onError?.(errorMessage);
	}
</script>

<div class="space-y-4">
	<!-- Scanner Card -->
	<Card class="w-full">
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<IconQrcode class="size-5" />
					QR Scanner
				</div>

				<div class="flex items-center gap-2">
					<Badge
						variant={cameraStatus === 'active'
							? 'default'
							: cameraStatus === 'error'
								? 'destructive'
								: 'secondary'}
					>
						{#if cameraStatus === 'requesting'}
							<IconCamera class="mr-1 size-3 animate-pulse" />
							{#if retryCount > 0}
								กำลังลองใหม่... ({retryCount}/{maxRetries})
							{:else}
								กำลังเชื่อมต่อ...
							{/if}
						{:else if cameraStatus === 'active'}
							<IconCamera class="mr-1 size-3" />
							พร้อมสแกน
						{:else if cameraStatus === 'error'}
							<IconCameraOff class="mr-1 size-3" />
							{#if retryCount >= maxRetries}
								เชื่อมต่อล้มเหลว
							{:else}
								ข้อผิดพลาด
							{/if}
						{:else}
							<IconCameraOff class="mr-1 size-3" />
							ปิด
						{/if}
					</Badge>

					{#if isProcessingScan}
						<Badge variant="secondary">
							<IconReload class="mr-1 size-3 animate-spin" />
							กำลังประมวลผล...
						</Badge>
					{/if}
				</div>
			</CardTitle>
		</CardHeader>

		<CardContent class="space-y-4">
			<!-- Camera Preview -->
			<div class="relative">
				<div
					class="relative overflow-hidden rounded-lg border-2 border-dashed bg-muted {debugInfo.deviceOrientation ===
					'portrait'
						? 'aspect-[3/4]'
						: 'aspect-video'} max-h-[600px] min-h-[300px]"
					id="video-container"
				>
					{#if cameraStatus === 'active' || cameraStatus === 'requesting'}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							bind:this={videoElement}
							class="absolute inset-0 h-full w-full bg-black object-cover transition-transform duration-300"
							playsinline={true}
							muted={true}
							autoplay={true}
							controls={false}
							preload="auto"
							style="width: 100% !important; height: 100% !important; object-fit: cover !important; background-color: black !important; z-index: 10;"
							onloadstart={() => console.log('Video load start')}
							onloadeddata={() => console.log('Video data loaded')}
							onloadedmetadata={() => {
								if (videoElement) {
									console.log(
										'Video metadata loaded - size:',
										videoElement.videoWidth,
										'x',
										videoElement.videoHeight
									);
									// Force video to be visible after metadata loads
									videoElement.style.opacity = '1';
									videoElement.style.visibility = 'visible';
									videoElement.style.display = 'block';
								}
							}}
							oncanplay={() => {
								if (videoElement) {
									console.log('Video can play');
									// Ensure video is visible when it can play
									videoElement.style.opacity = '1';
									videoElement.style.visibility = 'visible';
									videoElement.style.display = 'block';
								}
							}}
							oncanplaythrough={() => console.log('Video can play through')}
							onplaying={() => {
								if (videoElement) {
									console.log('Video playing');
									// Final check to make sure video is visible
									videoElement.style.opacity = '1';
									videoElement.style.visibility = 'visible';
									videoElement.style.display = 'block';
								}
							}}
							onerror={(e) => console.error('Video element error:', e)}
						></video>

						<!-- Debug overlay -->
						{#if import.meta.env.DEV}
							<div class="absolute top-2 left-2 z-30 rounded bg-black/70 p-2 text-xs text-white">
								Status: {cameraStatus}<br />
								Stream: {debugInfo.streamActive ? 'Yes' : 'No'}<br />
								Video: {videoElement?.videoWidth || 0}x{videoElement?.videoHeight || 0}<br />
								Element: {videoElement?.offsetWidth || 0}x{videoElement?.offsetHeight || 0}<br />
								Ready: {debugInfo.videoReady ? 'Yes' : 'No'}
							</div>
						{/if}

						<!-- Fallback debug overlay -->
						{#if debugInfo.streamActive && videoElement?.videoWidth === 0}
							<div
								class="absolute inset-0 z-20 flex items-center justify-center bg-red-500/20 text-sm text-white"
							>
								กล้องเชื่อมต่อแล้ว แต่ไม่มีภาพ
								<br />
								กรุณาตรวจสอบ Console
							</div>
						{/if}

						<!-- Scanning overlay -->
						<div class="pointer-events-none absolute inset-0">
							<!-- Scanning frame -->
							<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
								<div class="relative h-48 w-48 rounded-lg border-2 border-primary">
									<div
										class="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-primary"
									></div>
									<div
										class="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-primary"
									></div>
									<div
										class="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-primary"
									></div>
									<div
										class="absolute right-0 bottom-0 h-6 w-6 border-r-4 border-b-4 border-primary"
									></div>
								</div>
							</div>

							<!-- Instructions -->
							<div
								class="absolute bottom-4 left-1/2 -translate-x-1/2 transform rounded bg-black/50 px-3 py-1 text-sm text-white"
							>
								วางกรอบให้อยู่บน QR Code
							</div>
						</div>
					{:else if cameraStatus === 'error'}
						<div class="absolute inset-0 flex items-center justify-center">
							<div class="space-y-3 text-center text-muted-foreground">
								<IconCameraOff class="mx-auto size-12 text-destructive" />
								<div>
									<p class="font-medium text-destructive">ไม่สามารถเข้าถึงกล้องได้</p>
									<p class="text-sm">กรุณาอนุญาตการใช้งานกล้องและรีเฟรชหน้า</p>
								</div>
							</div>
						</div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center">
							<div class="space-y-3 text-center text-muted-foreground">
								<IconCamera class="mx-auto size-12" />
								<div>
									<p class="font-medium">เริ่มต้นการสแกน</p>
									<p class="text-sm">กดปุ่มเพื่อเปิดกล้อง</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Error Alert with Enhanced Feedback -->
			{#if error}
				<Alert variant={cameraStatus === 'error' ? 'destructive' : 'default'}>
					<IconAlertTriangle class="h-4 w-4" />
					<AlertDescription class="space-y-3">
						<div>{error}</div>

						{#if cameraStatus === 'error'}
							<div class="space-y-2">
								<!-- Retry button for camera errors -->
								<div class="flex gap-2">
									<Button size="sm" onclick={startCamera} disabled={cameraRequestInProgress}>
										<IconReload
											class="mr-2 h-3 w-3 {cameraRequestInProgress ? 'animate-spin' : ''}"
										/>
										{cameraRequestInProgress ? 'กำลังลองใหม่...' : 'ลองใหม่'}
									</Button>
								</div>

								<!-- Troubleshooting tips -->
								<div class="mt-2 text-sm text-muted-foreground">
									<p class="mb-1 font-medium">วิธีแก้ไข:</p>
									<ul class="list-inside list-disc space-y-1 text-xs">
										{#if error.includes('อนุญาต')}
											<li>คลิกไอคอนกล้องในแถบที่อยู่ของเบราว์เซอร์และเลือก "อนุญาต"</li>
											<li>รีเฟรชหน้าเว็บและลองใหม่</li>
										{:else if error.includes('ถูกใช้งาน') || error.includes('NotReadable')}
											<li>ปิดแอปหรือแท็บอื่นที่อาจใช้กล้อง (เช่น Google Meet, Zoom)</li>
											<li>ปิดแอปกล้องในมือถือ</li>
											<li>รีสตาร์ทเบราว์เซอร์และลองใหม่</li>
										{:else if error.includes('ไม่พบ')}
											<li>ตรวจสอบว่าอุปกรณ์มีกล้อง</li>
											<li>ลองเชื่อมต่อกล้องภายนอก (ถ้าเป็นคอมพิวเตอร์)</li>
										{:else}
											<li>รีเฟรชหน้าเว็บและลองใหม่</li>
											<li>ลองใช้เบราว์เซอร์อื่น (Chrome, Firefox, Safari)</li>
											<li>ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Control Buttons -->
			<div class="flex flex-col items-center gap-3">
				<!-- Mode toggle -->
				<div class="inline-flex overflow-hidden rounded-md border bg-background">
					<button
						class={`px-3 py-2 text-sm ${scanMode === 'checkin' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
						onclick={() => (scanMode = 'checkin')}
						type="button"
					>
						เช็คอิน
					</button>
					<button
						class={`px-3 py-2 text-sm ${scanMode === 'checkout' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
						onclick={() => (scanMode = 'checkout')}
						type="button"
					>
						เช็คเอาท์
					</button>
				</div>

				<!-- Camera controls -->
				<div class="flex justify-center gap-2">
					{#if cameraStatus === 'idle' || cameraStatus === 'error'}
						<Button onclick={startCamera} disabled={!activity_id}>
							<IconCamera class="mr-2 size-4" />
							เริ่มสแกน
						</Button>
					{:else if cameraStatus === 'active' || cameraStatus === 'requesting'}
						<Button onclick={stopCamera} variant="outline">
							<IconCameraOff class="mr-2 size-4" />
							หยุดสแกน
						</Button>
					{/if}

					<!-- Development: Manual scan trigger -->
					{#if cameraStatus === 'active'}
						<Button onclick={triggerManualScan} variant="outline" size="sm">
							<IconQrcode class="mr-2 size-4" />
							สแกนด้วยตนเอง
						</Button>
					{/if}
				</div>
			</div>

			<!-- Scanner Info -->
			<div class="space-y-1 text-center text-xs text-muted-foreground">
				{#if !activity_id}
					<p class="text-destructive">กรุณาเลือกกิจกรรมก่อนเริ่มสแกน</p>
				{:else}
					<p>วาง QR Code ของนักศึกษาให้อยู่ในกรอบเพื่อสแกน</p>
					<p>ระบบจะประมวลผลอัตโนมัติเมื่อตรวจพบ QR Code</p>
				{/if}

				<!-- Debug Information (development only) -->
				{#if import.meta.env.DEV}
					<div class="mt-4 rounded bg-muted/50 p-2 text-left">
						<p class="mb-1 text-xs font-semibold">Debug Info:</p>
						<div class="space-y-1 text-xs">
							<p>Camera Status: {cameraStatus}</p>
							<p>Request In Progress: {cameraRequestInProgress}</p>
							<p>Retry Count: {retryCount}/{maxRetries}</p>
							<p>Video Ready: {debugInfo.videoReady}</p>
							<p>Stream Active: {debugInfo.streamActive}</p>
							<p>Orientation: {debugInfo.deviceOrientation}</p>
							<p>Invalid Scans: {invalidScansCount}</p>
							{#if videoElement}
								<p>Video Size: {videoElement.videoWidth}x{videoElement.videoHeight}</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>

	<!-- Scan History -->
	{#if showHistory && scanHistory.length > 0}
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<CardTitle class="flex items-center gap-2">
						<IconUser class="size-5" />
						ประวัติการสแกน
						<Badge variant="outline">{scanHistory.length}</Badge>
					</CardTitle>

					<Button onclick={clearHistory} variant="outline" size="sm">
						<IconX class="mr-2 size-4" />
						ล้างประวัติ
					</Button>
				</div>
			</CardHeader>

			<CardContent>
				<div class="space-y-3">
					{#each scanHistory as item, index (item.timestamp)}
						<div class="flex items-center justify-between rounded-lg bg-muted/50 p-3">
							<div class="flex-1">
								<div class="mb-1 flex items-center gap-2">
									<IconCheck class="size-4 text-green-600" />
									<span class="font-medium">{item.user_name}</span>
									<Badge variant={getStatusBadgeVariant(item.participation_status)} class="text-xs">
										{getStatusText(item.participation_status)}
									</Badge>
								</div>
								<div class="flex items-center gap-4 text-sm text-muted-foreground">
									<span>รหัส: {item.student_id}</span>
									<div class="flex items-center gap-1">
										<IconClock class="size-3" />
										{formatDateTime(item.checked_in_at)}
									</div>
								</div>
							</div>
						</div>

						{#if index < scanHistory.length - 1}
							<Separator />
						{/if}
					{/each}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
