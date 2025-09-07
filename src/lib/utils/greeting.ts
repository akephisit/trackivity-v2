/**
 * Dynamic greeting system with time-based and random messages
 */

export interface GreetingMessage {
	greeting: string;
	subtitle: string;
}

// Time-based greetings
const morningGreetings = [
	{ greeting: "สวัสดีตอนเช้า", subtitle: "เริ่มวันใหม่ด้วยพลังงานเต็มเปี่ยม" },
	{ greeting: "อรุณสวัสดิ์", subtitle: "หวังว่าคุณจะมีวันที่ดี" },
	{ greeting: "สวัสดีครับ/ค่ะ", subtitle: "พร้อมสำหรับวันใหม่แล้วใช่ไหม" },
	{ greeting: "เช้าที่สดใส", subtitle: "ขอให้มีวันที่สดใสและมีความสุข" },
	{ greeting: "สวัสดี", subtitle: "ทานข้าวเช้าแล้วหรือยัง" }
];

const afternoonGreetings = [
	{ greeting: "สวัสดีตอนบ่าย", subtitle: "หวังว่าวันนี้จะเป็นวันที่ดี" },
	{ greeting: "สวัสดี", subtitle: "ทานข้าวเที่ยงแล้วหรือยัง" },
	{ greeting: "สบายดีไหม", subtitle: "ติดตามกิจกรรมและผลงานได้ที่นี่" },
	{ greeting: "วันนี้เป็นอย่างไรบ้าง", subtitle: "มาดูความคืบหน้าของคุณกัน" },
	{ greeting: "สวัสดี", subtitle: "กิจกรรมวันนี้เยอะไหม" }
];

const eveningGreetings = [
	{ greeting: "สวัสดีตอนเย็น", subtitle: "เหนื่อยมากไหมวันนี้" },
	{ greeting: "สวัสดี", subtitle: "วันนี้ทำกิจกรรมอะไรไปบ้าง" },
	{ greeting: "เย็นสบายนะ", subtitle: "มาดูสรุปกิจกรรมกัน" },
	{ greeting: "สวัสดี", subtitle: "เหนื่อยอีกแล้วใช่ไหม" },
	{ greeting: "สบายเย็นดี", subtitle: "ติดตามผลงานของคุณได้ที่นี่" }
];

const nightGreetings = [
	{ greeting: "สวัสดีค่ำ", subtitle: "ยังทำงานอยู่เหรอ" },
	{ greeting: "ดึกแล้วนะ", subtitle: "อย่าลืมพักผ่อนด้วย" },
	{ greeting: "สวัสดี", subtitle: "วันนี้ทำงานหนักมากไหม" },
	{ greeting: "สวัสดีตอนค่ำครับ/ค่ะ", subtitle: "เช็คความคืบหน้าก่อนนอนไหม" },
	{ greeting: "สวัสดี", subtitle: "หวังว่าวันนี้จะเป็นวันที่ดี" }
];

// Special day-based greetings
const mondayGreetings = [
	{ greeting: "สวัสดีวันจันทร์", subtitle: "เริ่มสัปดาห์ใหม่กันเถอะ" },
	{ greeting: "วันจันทร์มาแล้ว", subtitle: "พร้อมสำหรับสัปดาห์ใหม่หรือยัง" },
	{ greeting: "สวัสดี", subtitle: "สัปดาห์ใหม่ มีแผนอะไรบ้าง" }
];

const fridayGreetings = [
	{ greeting: "สวัสดีวันศุกร์", subtitle: "เก่งมาก เกือบจะครบสัปดาห์แล้ว" },
	{ greeting: "วันศุกร์แล้วนะ", subtitle: "วันหยุดใกล้เข้ามาแล้ว" },
	{ greeting: "สวัสดี", subtitle: "รอวันหยุดอยู่ใช่ไหม" }
];

const weekendGreetings = [
	{ greeting: "สวัสดีวันหยุด", subtitle: "หวังว่าจะได้พักผ่อน" },
	{ greeting: "วันหยุดสบายดี", subtitle: "ยังคงสนใจกิจกรรมอยู่เหรอ" },
	{ greeting: "สุขสันต์วันหยุด", subtitle: "วันหยุดก็อย่าลืมดูกิจกรรมนะ" }
];

// Admin-specific greetings
const adminGreetings = [
	{ greeting: "สวัสดี", subtitle: "มีกิจกรรมใหม่ที่ต้องดูแลไหม" },
	{ greeting: "สวัสดีครับ/ค่ะ", subtitle: "วันนี้มีงานเยอะไหม" },
	{ greeting: "สวัสดี", subtitle: "จัดการระบบไปเรื่อยๆ นะ" },
	{ greeting: "ยินดีต้อนรับ", subtitle: "พร้อมจัดการกิจกรรมแล้วใช่ไหม" },
	{ greeting: "สวัสดี", subtitle: "ระบบพร้อมใช้งานแล้ว" }
];

// Student-specific greetings  
const studentGreetings = [
	{ greeting: "สวัสดี", subtitle: "มีกิจกรรมใหม่ที่น่าสนใจไหม" },
	{ greeting: "สวัสดี", subtitle: "วันนี้เรียนหนักไหม" },
	{ greeting: "สวัสดี", subtitle: "ลองดูกิจกรรมใหม่ๆ ไหม" },
	{ greeting: "ยินดีต้อนรับ", subtitle: "เตรียมตัวเข้าร่วมกิจกรรมหรือยัง" },
	{ greeting: "สวัสดี", subtitle: "ชั่วโมงกิจกรรมสะสมไปแค่ไหนแล้ว" }
];

/**
 * Get time period based on current hour
 */
function getTimePeriod(): 'morning' | 'afternoon' | 'evening' | 'night' {
	const hour = new Date().getHours();
	
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 17) return 'afternoon';  
	if (hour >= 17 && hour < 21) return 'evening';
	return 'night';
}

/**
 * Get day of week
 */
function getDayOfWeek(): 'monday' | 'friday' | 'weekend' | 'weekday' {
	const day = new Date().getDay();
	
	if (day === 1) return 'monday';
	if (day === 5) return 'friday';
	if (day === 0 || day === 6) return 'weekend';
	return 'weekday';
}

/**
 * Get random greeting message based on context
 */
export function getDynamicGreeting(
	firstName?: string, 
	userType: 'student' | 'admin' = 'student'
): GreetingMessage {
	const timePeriod = getTimePeriod();
	const dayOfWeek = getDayOfWeek();
	
	let availableGreetings: GreetingMessage[] = [];
	
	// Add time-based greetings (70% weight)
	switch (timePeriod) {
		case 'morning':
			availableGreetings.push(...morningGreetings, ...morningGreetings);
			break;
		case 'afternoon':
			availableGreetings.push(...afternoonGreetings, ...afternoonGreetings);
			break;
		case 'evening':
			availableGreetings.push(...eveningGreetings, ...eveningGreetings);
			break;
		case 'night':
			availableGreetings.push(...nightGreetings, ...nightGreetings);
			break;
	}
	
	// Add day-based greetings (20% weight)
	switch (dayOfWeek) {
		case 'monday':
			availableGreetings.push(...mondayGreetings);
			break;
		case 'friday':
			availableGreetings.push(...fridayGreetings);
			break;
		case 'weekend':
			availableGreetings.push(...weekendGreetings);
			break;
	}
	
	// Add user-type specific greetings (10% weight)
	if (userType === 'admin') {
		availableGreetings.push(...adminGreetings);
	} else {
		availableGreetings.push(...studentGreetings);
	}
	
	// Select random greeting
	const randomIndex = Math.floor(Math.random() * availableGreetings.length);
	const selectedGreeting = availableGreetings[randomIndex];
	
	// Add name to greeting if provided
	const greetingText = firstName 
		? `${selectedGreeting.greeting}, ${firstName}!`
		: `${selectedGreeting.greeting}!`;
	
	return {
		greeting: greetingText,
		subtitle: selectedGreeting.subtitle
	};
}

/**
 * Get greeting for display (cached version to prevent flickering)
 * This version uses a daily seed to ensure consistency within the same day
 */
export function getDailyGreeting(
	firstName?: string,
	userType: 'student' | 'admin' = 'student'
): GreetingMessage {
	// Create a daily seed based on date and user
	const today = new Date().toDateString();
	const userSeed = firstName || 'anonymous';
	const seed = `${today}-${userSeed}-${userType}`;
	
	// Simple hash function for consistent randomness
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	
	// Use seeded random for consistency
	const timePeriod = getTimePeriod();
	const dayOfWeek = getDayOfWeek();
	
	let availableGreetings: GreetingMessage[] = [];
	
	// Same logic as getDynamicGreeting but with seeded selection
	switch (timePeriod) {
		case 'morning':
			availableGreetings.push(...morningGreetings, ...morningGreetings);
			break;
		case 'afternoon':
			availableGreetings.push(...afternoonGreetings, ...afternoonGreetings);
			break;
		case 'evening':
			availableGreetings.push(...eveningGreetings, ...eveningGreetings);
			break;
		case 'night':
			availableGreetings.push(...nightGreetings, ...nightGreetings);
			break;
	}
	
	switch (dayOfWeek) {
		case 'monday':
			availableGreetings.push(...mondayGreetings);
			break;
		case 'friday':
			availableGreetings.push(...fridayGreetings);
			break;
		case 'weekend':
			availableGreetings.push(...weekendGreetings);
			break;
	}
	
	if (userType === 'admin') {
		availableGreetings.push(...adminGreetings);
	} else {
		availableGreetings.push(...studentGreetings);
	}
	
	// Use hash as seed for selection
	const selectedIndex = Math.abs(hash) % availableGreetings.length;
	const selectedGreeting = availableGreetings[selectedIndex];
	
	const greetingText = firstName 
		? `${selectedGreeting.greeting}, ${firstName}!`
		: `${selectedGreeting.greeting}!`;
	
	return {
		greeting: greetingText,
		subtitle: selectedGreeting.subtitle
	};
}