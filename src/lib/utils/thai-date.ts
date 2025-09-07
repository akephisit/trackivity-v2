/**
 * Thai Date Utilities for Buddhist Era and Thai Month Names
 * Provides utilities for formatting dates with Thai localization while maintaining backend compatibility
 */

import { type DateValue, getLocalTimeZone } from '@internationalized/date';

/**
 * Thai month names in full format
 */
export const THAI_MONTHS_FULL = [
	'มกราคม',
	'กุมภาพันธ์',
	'มีนาคม',
	'เมษายน',
	'พฤษภาคม',
	'มิถุนายน',
	'กรกฎาคม',
	'สิงหาคม',
	'กันยายน',
	'ตุลาคม',
	'พฤศจิกายน',
	'ธันวาคม'
] as const;

/**
 * Thai month names in short format
 */
export const THAI_MONTHS_SHORT = [
	'ม.ค.',
	'ก.พ.',
	'มี.ค.',
	'เม.ย.',
	'พ.ค.',
	'มิ.ย.',
	'ก.ค.',
	'ส.ค.',
	'ก.ย.',
	'ต.ค.',
	'พ.ย.',
	'ธ.ค.'
] as const;

/**
 * Convert Gregorian year to Buddhist Era year
 * @param gregorianYear - Year in CE format
 * @returns Year in Buddhist Era (พ.ศ.)
 */
export function toBuddhistEra(gregorianYear: number): number {
	return gregorianYear + 543;
}

/**
 * Convert Buddhist Era year to Gregorian year
 * @param buddhistYear - Year in Buddhist Era format
 * @returns Year in CE format
 */
export function fromBuddhistEra(buddhistYear: number): number {
	return buddhistYear - 543;
}

/**
 * Format a DateValue to Thai format with Buddhist Era
 * @param date - DateValue object
 * @param format - Format type ('short' | 'long')
 * @returns Formatted Thai date string
 */
export function formatThaiDate(date: DateValue, format: 'short' | 'long' = 'long'): string {
	const jsDate = date.toDate(getLocalTimeZone());
	const day = jsDate.getDate();
	const month = jsDate.getMonth();
	const year = toBuddhistEra(jsDate.getFullYear());

	const monthNames = format === 'short' ? THAI_MONTHS_SHORT : THAI_MONTHS_FULL;

	return `${day} ${monthNames[month]} ${year}`;
}

/**
 * Format month name in Thai
 * @param monthIndex - Month index (0-11)
 * @param format - Format type ('short' | 'long')
 * @returns Thai month name
 */
export function formatThaiMonth(monthIndex: number, format: 'short' | 'long' = 'long'): string {
	if (monthIndex < 0 || monthIndex > 11) {
		throw new Error('Month index must be between 0 and 11');
	}

	const monthNames = format === 'short' ? THAI_MONTHS_SHORT : THAI_MONTHS_FULL;
	return monthNames[monthIndex];
}

/**
 * Format year in Buddhist Era with พ.ศ. prefix
 * @param year - Year in CE format
 * @returns Formatted Buddhist Era year
 */
export function formatThaiYear(year: number): string {
	return `พ.ศ. ${toBuddhistEra(year)}`;
}

/**
 * Generate options for month selection in Thai
 * @param format - Format type ('short' | 'long')
 * @returns Array of month options with value (1-12) and Thai label
 */
export function getThaiMonthOptions(format: 'short' | 'long' = 'long') {
	const monthNames = format === 'short' ? THAI_MONTHS_SHORT : THAI_MONTHS_FULL;

	return monthNames.map((name, index) => ({
		value: index + 1,
		label: name
	}));
}

/**
 * Generate options for year selection in Buddhist Era
 * @param startYear - Starting CE year
 * @param endYear - Ending CE year
 * @returns Array of year options with CE value and Buddhist Era label
 */
export function getThaiYearOptions(startYear: number, endYear: number) {
	const options = [];

	for (let year = startYear; year <= endYear; year++) {
		options.push({
			value: year,
			label: toBuddhistEra(year).toString()
		});
	}

	return options;
}

/**
 * Custom DateFormatter for Thai locale with Buddhist Era support
 */
export class ThaiDateFormatter {
	private locale: string;

	constructor(locale: string = 'th-TH') {
		this.locale = locale;
	}

	/**
	 * Format a DateValue with Thai month names and Buddhist Era
	 * @param date - DateValue to format
	 * @param options - Formatting options
	 * @returns Formatted date string
	 */
	format(
		date: DateValue,
		options?: {
			year?: 'numeric' | '2-digit';
			month?: 'numeric' | '2-digit' | 'long' | 'short';
			day?: 'numeric' | '2-digit';
			era?: boolean;
		}
	): string {
		const jsDate = date.toDate(getLocalTimeZone());
		const day = jsDate.getDate();
		const month = jsDate.getMonth();
		const year = jsDate.getFullYear();

		const opts = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			era: true,
			...options
		};

		let result = '';

		// Format day
		if (opts.day === 'numeric') {
			result += day;
		} else if (opts.day === '2-digit') {
			result += day.toString().padStart(2, '0');
		}

		// Format month
		if (opts.month === 'long') {
			result += ` ${THAI_MONTHS_FULL[month]}`;
		} else if (opts.month === 'short') {
			result += ` ${THAI_MONTHS_SHORT[month]}`;
		} else if (opts.month === 'numeric') {
			result += `/${month + 1}`;
		} else if (opts.month === '2-digit') {
			result += `/${(month + 1).toString().padStart(2, '0')}`;
		}

		// Format year
		if (opts.era) {
			if (opts.year === 'numeric') {
				result += ` พ.ศ. ${toBuddhistEra(year)}`;
			} else if (opts.year === '2-digit') {
				result += ` พ.ศ. ${toBuddhistEra(year).toString().slice(-2)}`;
			}
		} else {
			if (opts.year === 'numeric') {
				result += ` ${year}`;
			} else if (opts.year === '2-digit') {
				result += ` ${year.toString().slice(-2)}`;
			}
		}

		return result.trim();
	}
}
