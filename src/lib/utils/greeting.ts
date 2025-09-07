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
	{ greeting: "สวัสดี", subtitle: "พร้อมสำหรับวันใหม่แล้วใช่ไหม" },
	{ greeting: "เช้าที่สดใส", subtitle: "ขอให้มีวันที่สดใสและมีความสุข" },
	{ greeting: "ทานข้าวเช้าแล้วหรือยัง", subtitle: "เริ่มวันด้วยอาหารมื้อสำคัญ" }
];

const preNoonGreetings = [
	{ greeting: "หิวข้าวหรือยัง", subtitle: "เกือบเที่ยงแล้วนะ" },
	{ greeting: "อยากทานอะไรไหม", subtitle: "มาดูกิจกรรมเสร็จแล้วค่อยไปกิน" },
	{ greeting: "เตรียมทานข้าวกันหรือยัง", subtitle: "ใกล้เที่ยงแล้ว" },
	{ greeting: "ใกล้เที่ยงแล้วนะ", subtitle: "หิวไหม" },
	{ greeting: "วันนี้จะทานข้าวที่ไหนดี", subtitle: "เช็คกิจกรรมเสร็จแล้วค่อยไป" },
	{ greeting: "เกือบเที่ยงแล้ว", subtitle: "พร้อมไปทานข้าวหรือยัง" }
];

const afternoonGreetings = [
	{ greeting: "สวัสดีตอนบ่าย", subtitle: "หวังว่าวันนี้จะเป็นวันที่ดี" },
	{ greeting: "ทานข้าวเที่ยงแล้วหรือยัง", subtitle: "มาดูกิจกรรมต่อกัน" },
	{ greeting: "สบายดีไหม", subtitle: "ติดตามกิจกรรมและผลงานได้ที่นี่" },
	{ greeting: "วันนี้เป็นอย่างไรบ้าง", subtitle: "มาดูความคืบหน้าของคุณกัน" },
	{ greeting: "กิจกรรมวันนี้เยอะไหม", subtitle: "มาเช็คดูกัน" },
	{ greeting: "อิ่มแล้วใช่ไหม", subtitle: "พร้อมทำกิจกรรมต่อหรือยัง" }
];

const eveningGreetings = [
	{ greeting: "สวัสดีตอนเย็น", subtitle: "เหนื่อยมากไหมวันนี้" },
	{ greeting: "วันนี้ทำกิจกรรมอะไรไปบ้าง", subtitle: "มาดูสรุปกัน" },
	{ greeting: "เย็นสบายนะ", subtitle: "มาดูสรุปกิจกรรมกัน" },
	{ greeting: "เหนื่อยอีกแล้วใช่ไหม", subtitle: "พักบ้างนะ" },
	{ greeting: "สวัสดีตอนเย็น", subtitle: "ติดตามผลงานของคุณได้ที่นี่" },
	{ greeting: "วันนี้เป็นยังไงบ้าง", subtitle: "เช็คกิจกรรมก่อนกลับบ้านไหม" }
];

const nightGreetings = [
	{ greeting: "สวัสดีตอนค่ำ", subtitle: "ยังทำงานอยู่เหรอ" },
	{ greeting: "ดึกแล้วนะ", subtitle: "อย่าลืมพักผ่อนด้วย" },
	{ greeting: "วันนี้ทำงานหนักมากไหม", subtitle: "พักบ้างนะ" },
	{ greeting: "สวัสดีตอนค่ำ", subtitle: "เช็คความคืบหน้าก่อนนอนไหม" },
	{ greeting: "ยังไม่นอนเหรอ", subtitle: "ดูแลสุขภาพด้วยนะ" },
	{ greeting: "วันนี้เป็นยังไงบ้าง", subtitle: "หวังว่าจะเป็นวันที่ดี" }
];

// Special day-based greetings
const mondayGreetings = [
	{ greeting: "สวัสดีวันจันทร์", subtitle: "เริ่มสัปดาห์ใหม่กันเถอะ" },
	{ greeting: "วันจันทร์มาแล้ว", subtitle: "พร้อมสำหรับสัปดาห์ใหม่หรือยัง" },
	{ greeting: "สัปดาห์ใหม่มาแล้ว", subtitle: "มีแผนอะไรบ้าง" }
];

const fridayGreetings = [
	{ greeting: "สวัสดีวันศุกร์", subtitle: "เก่งมาก เกือบครบสัปดาห์แล้ว" },
	{ greeting: "วันศุกร์แล้วนะ", subtitle: "วันหยุดใกล้เข้ามาแล้ว" },
	{ greeting: "รอวันหยุดอยู่ใช่ไหม", subtitle: "อีกนิดเดียวเท่านั้น" }
];

const weekendGreetings = [
	{ greeting: "สวัสดีวันหยุด", subtitle: "หวังว่าจะได้พักผ่อน" },
	{ greeting: "วันหยุด สบายดี", subtitle: "ยังคงสนใจกิจกรรมอยู่เหรอ" },
	{ greeting: "สุขสันต์วันหยุด", subtitle: "วันหยุดก็อย่าลืมดูกิจกรรมนะ" }
];

// Admin-specific greetings
const adminGreetings = [
	{ greeting: "มีกิจกรรมใหม่ที่ต้องดูแลไหม", subtitle: "เช็คระบบกันเถอะ" },
	{ greeting: "วันนี้มีงานเยอะไหม", subtitle: "จัดการไปทีละน้อยนะ" },
	{ greeting: "จัดการระบบไปเรื่อยๆ นะ", subtitle: "คุณทำได้ดีมาก" },
	{ greeting: "พร้อมจัดการกิจกรรมแล้วใช่ไหม", subtitle: "ระบบพร้อมใช้งานแล้ว" },
	{ greeting: "วันนี้มีอะไรต้องอนุมัติไหม", subtitle: "มาดูกันเลย" },
	{ greeting: "ระบบเป็นยังไงบ้าง", subtitle: "ทุกอย่างเรียบร้อยดีไหม" }
];

// Student-specific greetings  
const studentGreetings = [
	{ greeting: "มีกิจกรรมใหม่ที่น่าสนใจไหม", subtitle: "มาดูกันเลย" },
	{ greeting: "วันนี้เรียนหนักไหม", subtitle: "พักสมองด้วยกิจกรรมสนุกๆ ไหม" },
	{ greeting: "ลองดูกิจกรรมใหม่ๆ ไหม", subtitle: "อาจจะมีอะไรน่าสนใจ" },
	{ greeting: "เตรียมตัวเข้าร่วมกิจกรรมหรือยัง", subtitle: "มีหลายอย่างให้เลือก" },
	{ greeting: "ชั่วโมงกิจกรรมสะสมไปแค่ไหนแล้ว", subtitle: "เช็คความคืบหน้ากัน" },
	{ greeting: "วันนี้มีแผนเข้ากิจกรรมไหม", subtitle: "มาดูตัวเลือกกันเถอะ" }
];

/**
 * Get time period based on current hour
 */
function getTimePeriod(): 'morning' | 'prenoon' | 'afternoon' | 'evening' | 'night' {
	const hour = new Date().getHours();
	
	if (hour >= 5 && hour < 10) return 'morning';
	if (hour >= 10 && hour < 12) return 'prenoon';
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
		case 'prenoon':
			availableGreetings.push(...preNoonGreetings, ...preNoonGreetings);
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
 * Get time-sensitive greeting that changes throughout the day
 * Uses user-based seed for variety while respecting time periods
 */
export function getDailyGreeting(
	firstName?: string,
	userType: 'student' | 'admin' = 'student'
): GreetingMessage {
	// Create seed based on user but not time (so it changes by time period)
	const today = new Date().toDateString();
	const userSeed = firstName || 'anonymous';
	const timePeriod = getTimePeriod();
	const dayOfWeek = getDayOfWeek();
	
	// Create seed that includes time period so it changes throughout the day
	const seed = `${today}-${userSeed}-${userType}-${timePeriod}`;
	
	// Simple hash function for consistent randomness
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	
	let availableGreetings: GreetingMessage[] = [];
	
	// Add time-based greetings (most weight)
	switch (timePeriod) {
		case 'morning':
			availableGreetings.push(...morningGreetings, ...morningGreetings);
			break;
		case 'prenoon':
			availableGreetings.push(...preNoonGreetings, ...preNoonGreetings);
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
	
	// Add day-based greetings
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
	
	// Add user-type specific greetings
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