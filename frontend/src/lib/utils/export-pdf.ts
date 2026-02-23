/**
 * PDF Export utility for Student Activity Summary
 * Uses pdfmake with Sarabun font loaded at runtime (supports Thai)
 */
import type { ActivitySummaryStats } from '$lib/utils/activity-summary';
import { getPrefixLabel } from '$lib/schemas/auth';
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
    prefix?: string | null;
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

    // pdfmake v0.3.x uses addVirtualFileSystem() and addFonts() instead of .vfs / .fonts properties
    (pdfMake as any).addVirtualFileSystem({
        'Sarabun-Regular.ttf': regularB64,
        'Sarabun-Bold.ttf': boldB64
    });

    (pdfMake as any).addFonts({
        Sarabun: {
            normal: 'Sarabun-Regular.ttf',
            bold: 'Sarabun-Bold.ttf',
            italics: 'Sarabun-Regular.ttf',
            bolditalics: 'Sarabun-Bold.ttf'
        }
    });

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
        pageMargins: [40, 70, 40, 60],
        background: function (currentPage: number, pageSize: any) {
            // Elegant blue top border accent for every page
            return {
                canvas: [
                    {
                        type: 'rect',
                        x: 0,
                        y: 0,
                        w: pageSize.width,
                        h: 12,
                        color: '#1e3a8a'
                    }
                ]
            };
        },
        content: [
            // Header Section
            {
                columns: [
                    {
                        width: '*',
                        stack: [
                            { text: 'รายงานสรุปผลการเข้าร่วมกิจกรรม', style: 'header' },
                            { text: 'Academic Activity Summary Report', style: 'subheader' }
                        ]
                    },
                    {
                        width: 'auto',
                        text: 'Trackivity',
                        style: 'brandName',
                        margin: [0, 5, 0, 0]
                    }
                ],
                margin: [0, 0, 0, 15]
            },
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }],
                margin: [0, 0, 0, 20]
            },

            // Student Information
            { text: 'ข้อมูลนักศึกษา (Student Information)', style: 'sectionTitle', margin: [0, 0, 0, 10] },
            {
                table: {
                    widths: ['25%', '35%', '15%', '25%'],
                    body: [
                        [
                            { text: 'ชื่อ-นามสกุล:', style: 'label' },
                            { text: `${getPrefixLabel(userInfo.prefix)}${userInfo.first_name} ${userInfo.last_name}`, style: 'value' },
                            { text: 'รหัสนักศึกษา:', style: 'label' },
                            { text: userInfo.student_id, style: 'highlightValue' }
                        ],
                        [
                            { text: 'อีเมล:', style: 'label' },
                            { text: userInfo.email, style: 'value' },
                            { text: 'วันที่พิมพ์:', style: 'label' },
                            { text: now, style: 'value' }
                        ]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 25]
            },

            // Summary Stats and Level Breakdown side-by-side
            {
                columns: [
                    // Left Column: Summary Stats
                    {
                        width: '45%',
                        stack: [
                            { text: 'สรุปภาพรวม (Overview)', style: 'sectionTitle', margin: [0, 0, 0, 10] },
                            {
                                table: {
                                    widths: ['*', 'auto'],
                                    body: [
                                        [
                                            { text: 'กิจกรรมทั้งหมด', style: 'label' },
                                            { text: `${stats.totalActivities} กิจกรรม`, style: 'statValue' }
                                        ],
                                        [
                                            { text: 'เสร็จสิ้น', style: 'label' },
                                            { text: `${stats.completedActivities} กิจกรรม`, style: 'statValueValid' }
                                        ],
                                        [
                                            { text: 'ชั่วโมงรวม', style: 'label' },
                                            { text: `${stats.totalHours} ชั่วโมง`, style: 'statValueValid' }
                                        ],
                                        [
                                            { text: 'อัตราเสร็จสิ้น', style: 'label' },
                                            { text: `${stats.completionRate}%`, style: 'statValue' }
                                        ]
                                    ]
                                },
                                layout: {
                                    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
                                    vLineWidth: () => 0,
                                    hLineColor: () => '#e5e7eb',
                                    paddingTop: () => 6,
                                    paddingBottom: () => 6
                                }
                            }
                        ]
                    },
                    { width: '10%', text: '' }, // Spacer
                    // Right Column: Level Breakdown
                    {
                        width: '45%',
                        stack: [
                            { text: 'สัดส่วนกิจกรรม (Distribution)', style: 'sectionTitle', margin: [0, 0, 0, 10] },
                            {
                                table: {
                                    widths: ['*', 'auto', 'auto'],
                                    body: [
                                        [
                                            { text: 'ระดับ', style: 'tableHeaderSmall', alignment: 'left' },
                                            { text: 'กิจกรรม', style: 'tableHeaderSmall', alignment: 'center' },
                                            { text: 'ชั่วโมง', style: 'tableHeaderSmall', alignment: 'center' }
                                        ],
                                        [
                                            { text: 'ระดับคณะ', style: 'tableCell' },
                                            { text: `${stats.facultyLevel.activities}`, style: 'tableCell', alignment: 'center' },
                                            { text: `${stats.facultyLevel.hours}`, style: 'tableCell', alignment: 'center' }
                                        ],
                                        [
                                            { text: 'ระดับมหาวิทยาลัย', style: 'tableCell' },
                                            { text: `${stats.universityLevel.activities}`, style: 'tableCell', alignment: 'center' },
                                            { text: `${stats.universityLevel.hours}`, style: 'tableCell', alignment: 'center' }
                                        ],
                                        [
                                            { text: 'รวม', style: 'tableCellBold' },
                                            { text: `${stats.completedActivities}`, style: 'tableCellBold', alignment: 'center' },
                                            { text: `${stats.totalHours}`, style: 'tableCellBold', alignment: 'center' }
                                        ]
                                    ]
                                },
                                layout: {
                                    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.5),
                                    vLineWidth: () => 0,
                                    hLineColor: () => '#e5e7eb',
                                    paddingTop: () => 6,
                                    paddingBottom: () => 6
                                }
                            }
                        ]
                    }
                ],
                margin: [0, 0, 0, 30]
            },

            // Line Separator
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }],
                margin: [0, 0, 0, 20]
            },

            // Activity List
            {
                text: `รายการกิจกรรมที่เข้าร่วมเสร็จสิ้น (${completedParticipations.length} รายการ)`,
                style: 'sectionTitle',
                margin: [0, 0, 0, 10]
            },
            participationRows.length > 0
                ? {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: '#', style: 'tableHeader', alignment: 'center' },
                                { text: 'ชื่อกิจกรรม (Activity Title)', style: 'tableHeader' },
                                { text: 'ระดับ (Level)', style: 'tableHeader', alignment: 'center' },
                                { text: 'ชั่วโมง (hrs)', style: 'tableHeader', alignment: 'center' },
                                { text: 'วันที่ลงทะเบียน (Date)', style: 'tableHeader', alignment: 'center' }
                            ],
                            ...participationRows
                        ]
                    },
                    layout: {
                        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
                        vLineWidth: () => 0,
                        hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? '#1e3a8a' : '#e5e7eb'),
                        fillColor: (rowIndex: number) => (rowIndex === 0 ? '#eff6ff' : null),
                        paddingTop: () => 8,
                        paddingBottom: () => 8
                    }
                }
                : { text: 'ยังไม่มีประวัติการเข้าร่วมกิจกรรมที่เสร็จสิ้น', style: 'muted', margin: [0, 0, 0, 20] },

            // Footer / Sign-off
            {
                stack: [
                    { text: 'เอกสารอ้างอิงรายบุคคล', style: 'footerBold' },
                    { text: 'ระบบจัดการกิจกรรม Trackivity (Activity Tracking System)', style: 'footer' },
                    { text: `ออกรายงานเมื่อ: ${now}`, style: 'footer' }
                ],
                margin: [0, 40, 0, 0],
                alignment: 'center'
            }
        ],
        styles: {
            header: { fontSize: 20, bold: true, font: 'Sarabun', color: '#111827' },
            subheader: { fontSize: 13, color: '#4b5563', font: 'Sarabun' },
            brandName: { fontSize: 16, bold: true, color: '#1e3a8a', font: 'Sarabun' },
            sectionTitle: { fontSize: 14, bold: true, font: 'Sarabun', color: '#1f2937' },
            label: { fontSize: 12, color: '#6b7280', font: 'Sarabun' },
            value: { fontSize: 12, color: '#111827', font: 'Sarabun' },
            highlightValue: { fontSize: 12, bold: true, color: '#1e3a8a', font: 'Sarabun' },
            statValue: { fontSize: 12, bold: true, color: '#111827', font: 'Sarabun', alignment: 'right' },
            statValueValid: { fontSize: 12, bold: true, color: '#166534', font: 'Sarabun', alignment: 'right' },
            tableHeader: { fontSize: 11, bold: true, color: '#1e3a8a', font: 'Sarabun' },
            tableHeaderSmall: { fontSize: 11, bold: true, color: '#4b5563', font: 'Sarabun' },
            tableCell: { fontSize: 11, color: '#374151', font: 'Sarabun' },
            tableCellBold: { fontSize: 11, bold: true, color: '#111827', font: 'Sarabun' },
            muted: { fontSize: 12, color: '#9ca3af', font: 'Sarabun', italics: true },
            footer: { fontSize: 10, color: '#6b7280', font: 'Sarabun' },
            footerBold: { fontSize: 10, bold: true, color: '#4b5563', font: 'Sarabun' }
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
