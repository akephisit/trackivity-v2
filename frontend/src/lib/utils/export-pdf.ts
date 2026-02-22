/**
 * PDF Export utility for Student Activity Summary
 * Uses pdfmake with Sarabun font loaded at runtime (supports Thai)
 */
import type { ActivitySummaryStats } from '$lib/utils/activity-summary';
import { browser } from '$app/environment';

// Sarabun Regular & Bold TTF from Google Fonts repository (stable URLs)
const SARABUN_REGULAR_URL =
    'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf';
const SARABUN_BOLD_URL =
    'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf';

async function fetchFontAsBase64(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

interface UserInfo {
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
}

export async function exportSummaryPDF(
    userInfo: UserInfo,
    stats: ActivitySummaryStats,
    participations: any[]
): Promise<void> {
    if (!browser) return;

    // Dynamically import pdfmake (avoids SSR issues)
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = pdfMakeModule.default || pdfMakeModule;

    // Load Thai font at runtime
    const [regularB64, boldB64] = await Promise.all([
        fetchFontAsBase64(SARABUN_REGULAR_URL),
        fetchFontAsBase64(SARABUN_BOLD_URL)
    ]);

    (pdfMake as any).vfs = {
        'Sarabun-Regular.ttf': regularB64,
        'Sarabun-Bold.ttf': boldB64
    };

    (pdfMake as any).fonts = {
        Sarabun: {
            normal: 'Sarabun-Regular.ttf',
            bold: 'Sarabun-Bold.ttf',
            italics: 'Sarabun-Regular.ttf',
            bolditalics: 'Sarabun-Bold.ttf'
        }
    };

    const now = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Build participation rows (completed only)
    const completedParticipations = participations.filter(
        (p) => p.status === 'completed' || p.status === 'checked_out'
    );

    const participationRows = completedParticipations.map((p, i) => [
        { text: (i + 1).toString(), style: 'tableCell', alignment: 'center' },
        { text: p.activity?.title || '-', style: 'tableCell' },
        {
            text:
                p.activity?.activity_level === 'faculty'
                    ? 'ระดับคณะ'
                    : p.activity?.activity_level === 'university'
                        ? 'ระดับมหาวิทยาลัย'
                        : '-',
            style: 'tableCell',
            alignment: 'center'
        },
        {
            text: p.activity?.hours ? `${p.activity.hours} ชม.` : '-',
            style: 'tableCell',
            alignment: 'center'
        },
        {
            text: p.registered_at ? formatDate(p.registered_at) : '-',
            style: 'tableCell',
            alignment: 'center'
        }
    ]);

    const docDefinition: any = {
        defaultStyle: { font: 'Sarabun', fontSize: 13, lineHeight: 1.4 },
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
            // Header
            {
                text: 'รายงานสรุปผลการเข้าร่วมกิจกรรม',
                style: 'header',
                alignment: 'center',
                margin: [0, 0, 0, 4]
            },
            {
                text: 'Academic Activity Summary Report',
                style: 'subheader',
                alignment: 'center',
                margin: [0, 0, 0, 20]
            },

            // Student Info
            {
                table: {
                    widths: ['30%', '70%'],
                    body: [
                        [
                            { text: 'ชื่อ-นามสกุล', style: 'label' },
                            { text: `${userInfo.first_name} ${userInfo.last_name}`, style: 'value' }
                        ],
                        [
                            { text: 'รหัสนักศึกษา', style: 'label' },
                            { text: userInfo.student_id, style: 'value' }
                        ],
                        [
                            { text: 'อีเมล', style: 'label' },
                            { text: userInfo.email, style: 'value' }
                        ],
                        [
                            { text: 'วันที่ออกรายงาน', style: 'label' },
                            { text: now, style: 'value' }
                        ]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 20]
            },

            // Summary Stats
            { text: 'สรุปภาพรวม', style: 'sectionTitle', margin: [0, 0, 0, 8] },
            {
                columns: [
                    {
                        table: {
                            widths: ['*', '*'],
                            body: [
                                [
                                    { text: 'กิจกรรมทั้งหมด', style: 'label' },
                                    { text: `${stats.totalActivities} กิจกรรม`, style: 'statValue' }
                                ],
                                [
                                    { text: 'เสร็จสิ้น', style: 'label' },
                                    { text: `${stats.completedActivities} กิจกรรม`, style: 'statValue' }
                                ],
                                [
                                    { text: 'ชั่วโมงรวม', style: 'label' },
                                    { text: `${stats.totalHours} ชั่วโมง`, style: 'statValue' }
                                ],
                                [
                                    { text: 'อัตราเสร็จสิ้น', style: 'label' },
                                    { text: `${stats.completionRate}%`, style: 'statValue' }
                                ]
                            ]
                        },
                        layout: 'lightHorizontalLines'
                    }
                ],
                margin: [0, 0, 0, 16]
            },

            // Level Breakdown
            { text: 'แยกตามระดับกิจกรรม', style: 'sectionTitle', margin: [0, 0, 0, 8] },
            {
                table: {
                    widths: ['*', '*', '*'],
                    body: [
                        [
                            { text: 'ระดับ', style: 'tableHeader', alignment: 'center' },
                            { text: 'จำนวนกิจกรรม', style: 'tableHeader', alignment: 'center' },
                            { text: 'ชั่วโมง', style: 'tableHeader', alignment: 'center' }
                        ],
                        [
                            { text: 'ระดับคณะ', style: 'tableCell' },
                            { text: `${stats.facultyLevel.activities}`, style: 'tableCell', alignment: 'center' },
                            {
                                text: `${stats.facultyLevel.hours} ชม.`,
                                style: 'tableCell',
                                alignment: 'center'
                            }
                        ],
                        [
                            { text: 'ระดับมหาวิทยาลัย', style: 'tableCell' },
                            {
                                text: `${stats.universityLevel.activities}`,
                                style: 'tableCell',
                                alignment: 'center'
                            },
                            {
                                text: `${stats.universityLevel.hours} ชม.`,
                                style: 'tableCell',
                                alignment: 'center'
                            }
                        ],
                        [
                            { text: 'รวม', style: 'tableCellBold' },
                            {
                                text: `${stats.completedActivities}`,
                                style: 'tableCellBold',
                                alignment: 'center'
                            },
                            { text: `${stats.totalHours} ชม.`, style: 'tableCellBold', alignment: 'center' }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

            // Activity List
            {
                text: `รายการกิจกรรมที่เสร็จสิ้น (${completedParticipations.length} รายการ)`,
                style: 'sectionTitle',
                margin: [0, 0, 0, 8]
            },
            participationRows.length > 0
                ? {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: '#', style: 'tableHeader', alignment: 'center' },
                                { text: 'ชื่อกิจกรรม', style: 'tableHeader' },
                                { text: 'ระดับ', style: 'tableHeader', alignment: 'center' },
                                { text: 'ชั่วโมง', style: 'tableHeader', alignment: 'center' },
                                { text: 'วันที่ลงทะเบียน', style: 'tableHeader', alignment: 'center' }
                            ],
                            ...participationRows
                        ]
                    },
                    layout: 'lightHorizontalLines'
                }
                : { text: 'ยังไม่มีกิจกรรมที่เสร็จสิ้น', style: 'muted', margin: [0, 0, 0, 16] },

            // Footer
            { text: ' ', margin: [0, 20, 0, 0] },
            {
                text: 'รายงานนี้สร้างขึ้นโดยระบบ Trackivity - Activity Tracking System',
                style: 'footer',
                alignment: 'center'
            }
        ],
        styles: {
            header: { fontSize: 18, bold: true, font: 'Sarabun' },
            subheader: { fontSize: 13, color: '#666666', font: 'Sarabun' },
            sectionTitle: { fontSize: 14, bold: true, font: 'Sarabun', color: '#1a1a1a' },
            label: { fontSize: 12, color: '#555555', font: 'Sarabun' },
            value: { fontSize: 12, font: 'Sarabun' },
            statValue: { fontSize: 12, bold: true, font: 'Sarabun' },
            tableHeader: { fontSize: 12, bold: true, fillColor: '#f3f4f6', font: 'Sarabun' },
            tableCell: { fontSize: 11, font: 'Sarabun' },
            tableCellBold: { fontSize: 11, bold: true, font: 'Sarabun' },
            muted: { fontSize: 12, color: '#888888', font: 'Sarabun', italics: true },
            footer: { fontSize: 10, color: '#aaaaaa', font: 'Sarabun' }
        }
    };

    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() + 543; // Buddhist year
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const filename = `${userInfo.first_name}-${day}-${month}-${year}-${hours}-${minutes}.pdf`;
    (pdfMake as any).createPdf(docDefinition).download(filename);
}
