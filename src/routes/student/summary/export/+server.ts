import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { getStudentSummary } from '$lib/server/student-summary';
import PdfPrinter from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import path from 'path';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const fontDir = path.resolve(process.cwd(), 'static/fonts/THSarabunNew');

const fonts = {
	Sarabun: {
		normal: path.join(fontDir, 'Sarabun-Regular.ttf'),
		bold: path.join(fontDir, 'Sarabun-Bold.ttf'),
		italics: path.join(fontDir, 'Sarabun-Italic.ttf'),
		bolditalics: path.join(fontDir, 'Sarabun-BoldItalic.ttf')
	}
} as const;

const printer = new PdfPrinter(fonts);

const PARTICIPATION_STATUS_LABELS: Record<string, string> = {
	registered: 'ลงทะเบียน',
	checked_in: 'เช็กอิน',
	checked_out: 'เช็กเอาต์',
	completed: 'เสร็จสมบูรณ์',
	cancelled: 'ยกเลิก',
	pending: 'รอดำเนินการ'
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
	Academic: 'วิชาการ',
	Sports: 'กีฬา',
	Cultural: 'วัฒนธรรม',
	Social: 'สังคม',
	Other: 'อื่นๆ'
};

const formatDateTime = (value: string | null): string => {
	if (!value) return '-';
	try {
		return format(new Date(value), "d MMMM yyyy 'เวลา' HH:mm น.", { locale: th });
	} catch {
		return value;
	}
};

const formatDate = (value: string | null): string => {
	if (!value) return '-';
	try {
		return format(new Date(value), 'd MMMM yyyy', { locale: th });
	} catch {
		return value;
	}
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

	const activityTypeSummary = participationHistory.reduce<Record<string, { count: number; hours: number }>>(
		(acc, item) => {
			const key = item.activity.activity_type ?? 'Other';
			if (!acc[key]) {
				acc[key] = { count: 0, hours: 0 };
			}
			acc[key].count += 1;
			acc[key].hours += item.activity.hours ?? 0;
			return acc;
		},
		{}
	);

const tableBody: any[] = [
        [
            { text: 'ลำดับ', style: 'tableHeader' },
            { text: 'ชื่อกิจกรรม', style: 'tableHeader' },
            { text: 'วันที่เข้าร่วม', style: 'tableHeader' },
            { text: 'ชั่วโมง', style: 'tableHeader', alignment: 'right' },
            { text: 'สถานะ', style: 'tableHeader' }
        ],
        ...participationHistory.map((item, index) => [
            { text: String(index + 1), alignment: 'center' },
            {
                stack: [
                    { text: item.activity.title ?? '-', bold: true },
                    {
						text: `${ACTIVITY_TYPE_LABELS[item.activity.activity_type] ?? 'กิจกรรมอื่นๆ'} • ${item.activity.organizer_name ?? 'ไม่ระบุ'}`,
						color: '#4b5563',
						fontSize: 11
					}
				]
			},
			{ text: formatDateTime(item.participated_at), alignment: 'left' },
			{ text: (item.activity.hours ?? 0).toFixed(2), alignment: 'right' },
            { text: PARTICIPATION_STATUS_LABELS[item.status ?? ''] ?? '-' }
        ])
];

if (participationHistory.length === 0) {
        tableBody.push([
            { text: '-', alignment: 'center' },
            { text: 'ยังไม่มีข้อมูลการเข้าร่วมกิจกรรม', colSpan: 4, alignment: 'center' },
            { text: '' },
            { text: '' },
            { text: '' }
        ]);
}

const now = new Date();

const activityTypeRows = Object.entries(activityTypeSummary)
        .sort(([, a], [, b]) => b.hours - a.hours)
        .map(([type, data]) => `• ${ACTIVITY_TYPE_LABELS[type] ?? type}: ${data.count} กิจกรรม (${data.hours.toFixed(2)} ชม.)`);

const content: Content[] = [];

content.push({
        columns: [
            {
                width: '60%',
                stack: [
                    { text: 'ข้อมูลนักศึกษา', style: 'sectionTitle' },
                    { text: `ชื่อ-นามสกุล: ${userInfo.first_name} ${userInfo.last_name}` },
                    { text: `รหัสนักศึกษา: ${userInfo.student_id}` },
                    { text: `อีเมล: ${userInfo.email}` }
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
                margin: [0, 20, 0, 0],
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

if (activityTypeRows.length) {
        content.push({
                margin: [0, 20, 0, 10],
                stack: [
                        { text: 'ประเภทกิจกรรมที่เข้าร่วม', style: 'sectionTitle' },
                        { ul: activityTypeRows }
                ]
        });
}

content.push({
        margin: [0, 20, 0, 10],
        text: 'รายละเอียดกิจกรรมที่เข้าร่วม',
        style: 'sectionTitle'
});

content.push({
        table: {
                widths: ['auto', '*', 'auto', 'auto', 'auto'],
                body: tableBody
        },
        layout: {
                fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e0e7ff' : null)
        }
});

content.push({
        margin: [0, 30, 0, 0],
        columns: [
                {
                        text: `สรุปรวมทั้งหมด ${participationHistory.length} กิจกรรม`,
                        alignment: 'left'
                },
                {
                        stack: [
                                { text: 'ลงชื่อ...............................................', alignment: 'right' },
                                { text: '(...............................................)', alignment: 'right' },
                                { text: 'วันที่: ' + formatDate(new Date().toISOString()), alignment: 'right' }
                        ]
                }
        ]
});

const docDefinition: TDocumentDefinitions = {
        info: {
                title: 'รายงานสรุปกิจกรรมของนักศึกษา',
                author: 'Trackivity System'
        },
        pageMargins: [50, 80, 50, 60],
		header: {
			margin: [50, 20, 50, 0],
			columns: [
				{
					stack: [
						{ text: 'รายงานสรุปกิจกรรมของนักศึกษา', fontSize: 20, bold: true },
						{ text: 'Student Activity Participation Report', fontSize: 12 }
					]
				},
				{
					text: `วันที่ออกเอกสาร: ${format(now, 'd MMMM yyyy', { locale: th })}`,
					alignment: 'right'
				}
			]
		},
		footer: (currentPage: number, pageCount: number) => ({
			text: `หน้าที่ ${currentPage} / ${pageCount}`,
			alignment: 'right',
			margin: [0, 10, 40, 0]
		}),
        defaultStyle: {
                font: 'Sarabun',
                fontSize: 14,
                lineHeight: 1.3
        },
        content,
        styles: {
                sectionTitle: {
                        fontSize: 16,
                        bold: true,
				margin: [0, 0, 0, 6]
			},
			tableHeader: {
				bold: true,
				fontSize: 14,
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
