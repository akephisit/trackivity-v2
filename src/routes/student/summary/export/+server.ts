import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { getStudentSummary } from '$lib/server/student-summary';
import PdfPrinter from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import sarabunFonts from '$lib/fonts/sarabun';
import { format } from 'date-fns';

const fonts = sarabunFonts;

const printer = new PdfPrinter(fonts);

const formatThaiDate = (value: Date | string | null): string => {
	if (!value) return '-';
	const date = value instanceof Date ? value : new Date(value);
	return date.toLocaleDateString('th-TH', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
};

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const summary = await getStudentSummary(user);

	if (!summary.userInfo) {
		return new Response('ไม่พบข้อมูลนักศึกษา', { status: 404 });
	}

	const { participationHistory, userInfo, activityRequirements } = summary;

	const totalHours = participationHistory.reduce((acc, item) => acc + (item.activity.hours ?? 0), 0);
	const facultyHours = participationHistory
		.filter((item) => item.activity.activity_level === 'faculty')
		.reduce((acc, item) => acc + (item.activity.hours ?? 0), 0);
	const universityHours = participationHistory
		.filter((item) => item.activity.activity_level === 'university')
		.reduce((acc, item) => acc + (item.activity.hours ?? 0), 0);

const facultyActivities = participationHistory.filter(
	(item) => item.activity.activity_level === 'faculty'
);

const universityActivities = participationHistory.filter(
	(item) => item.activity.activity_level === 'university'
);

const sumHours = (items: typeof facultyActivities) =>
	items.reduce((total, item) => total + (item.activity.hours ?? 0), 0);

const buildSimpleTableBody = (items: typeof facultyActivities) => {
	const headerRow = [
		{ text: 'ลำดับ', style: 'tableHeader' },
		{ text: 'ชื่อกิจกรรม', style: 'tableHeader' },
		{ text: 'ชั่วโมง', style: 'tableHeader', alignment: 'right' }
	];

	const rows = items.map((item, index) => [
		{ text: String(index + 1), alignment: 'center' },
		{ text: item.activity.title ?? '-', margin: [0, 2, 0, 2] },
		{ text: (item.activity.hours ?? 0).toFixed(2), alignment: 'right' }
	]);

	const totalRow = [
		{ text: 'รวม', colSpan: 2, alignment: 'right', bold: true },
		{},
		{ text: sumHours(items).toFixed(2), alignment: 'right', bold: true }
	];

	return [headerRow, ...rows, totalRow];
};

const facultyTableBody = buildSimpleTableBody(facultyActivities);
const universityTableBody = buildSimpleTableBody(universityActivities);

const now = new Date();

const content: Content[] = [];

content.push({
        columns: [
                {
                        width: '60%',
                        stack: [
                                { text: 'ข้อมูลนักศึกษา', style: 'sectionTitle' },
                                { text: `ชื่อ-นามสกุล: ${userInfo.first_name} ${userInfo.last_name}` },
                                { text: `รหัสนักศึกษา: ${userInfo.student_id}` },
                                { text: `อีเมล: ${userInfo.email}` },
                                { text: `คณะ/หน่วยงาน: ${userInfo.organization_name ?? '-'}` },
                                { text: `ภาควิชา: ${userInfo.department_name ?? '-'}` }
                        ]
                },
                {
                        width: '40%',
                        stack: [
                                { text: 'สรุปชั่วโมงกิจกรรม', style: 'sectionTitle' },
                                { text: `รวมทั้งหมด: ${totalHours.toFixed(2)} ชั่วโมง` },
                                { text: `ระดับคณะ: ${facultyHours.toFixed(2)} ชั่วโมง` },
                                { text: `ระดับมหาวิทยาลัย: ${universityHours.toFixed(2)} ชั่วโมง` }
                        ]
                }
        ]
});

if (activityRequirements) {
        content.push({
                margin: [0, 16, 0, 0],
                stack: [
                        { text: 'ข้อกำหนดชั่วโมงกิจกรรม', style: 'sectionTitle' },
                        {
                                ul: [
                                        `ขั้นต่ำระดับคณะ: ${(activityRequirements.requiredFacultyHours ?? 0).toFixed(2)} ชั่วโมง`,
                                        `ขั้นต่ำระดับมหาวิทยาลัย: ${(activityRequirements.requiredUniversityHours ?? 0).toFixed(2)} ชั่วโมง`
                                ]
                        }
                ]
        });
}

content.push({
        margin: [0, 20, 0, 8],
        text: `รวมทั้งหมด ${participationHistory.length} กิจกรรม คิดเป็น ${totalHours.toFixed(2)} ชั่วโมง`,
        bold: true
});

content.push({ text: 'ตารางกิจกรรมระดับคณะ', style: 'sectionTitle', margin: [0, 12, 0, 6] });

if (facultyActivities.length) {
        content.push({
                table: {
                        widths: ['auto', '*', 'auto'],
                        body: facultyTableBody
                },
                layout: {
                        fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e0e7ff' : null)
                }
        });
} else {
        content.push({
                text: 'ยังไม่มีกิจกรรมระดับคณะ',
                margin: [0, 0, 0, 10],
                italics: true,
                color: '#6b7280'
        });
}

content.push({ text: 'ตารางกิจกรรมระดับมหาวิทยาลัย', style: 'sectionTitle', margin: [0, 16, 0, 6] });

if (universityActivities.length) {
        content.push({
                table: {
                        widths: ['auto', '*', 'auto'],
                        body: universityTableBody
                },
                layout: {
                        fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e0e7ff' : null)
                }
        });
} else {
        content.push({
                text: 'ยังไม่มีกิจกรรมระดับมหาวิทยาลัย',
                margin: [0, 0, 0, 10],
                italics: true,
                color: '#6b7280'
        });
}

const docDefinition: TDocumentDefinitions = {
        info: {
                title: 'รายงานสรุปกิจกรรมของนักศึกษา',
                author: 'Trackivity System'
        },
        pageMargins: [50, 80, 50, 60],
        pageSize: 'A4',
	header: {
		margin: [50, 40, 50, 0],
		columns: [
			{
				stack: [
					{ text: 'รายงานสรุปกิจกรรมของนักศึกษา', fontSize: 20, bold: true },
						{ text: 'Student Activity Participation Report', fontSize: 12 }
					]
				},
				{ text: '', alignment: 'right' }
			]
		},
		footer: (currentPage: number, pageCount: number) => ({
			text: `หน้าที่ ${currentPage} / ${pageCount}`,
			alignment: 'right',
			margin: [0, 10, 40, 0]
		}),
	defaultStyle: {
		font: 'Sarabun',
		fontSize: 11,
		lineHeight: 1.35
	},
	content,
	styles: {
		sectionTitle: {
			fontSize: 14,
			bold: true,
			margin: [0, 0, 0, 6]
		},
		tableHeader: {
			bold: true,
			fontSize: 11,
			color: '#1f2937'
		}
	}
};

const pdfDoc = printer.createPdfKitDocument(docDefinition);
const chunks: Buffer[] = [];

const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
});

const formattedDate = format(now, 'yyyyMMdd');

return new Response(new Uint8Array(pdfBuffer), {
        headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="student-activity-summary-${formattedDate}.pdf"`
        }
});
};
