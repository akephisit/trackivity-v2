import SarabunRegularDataUrl from '$lib/fonts/Sarabun/Sarabun-Regular.ttf?inline';
import SarabunBoldDataUrl from '$lib/fonts/Sarabun/Sarabun-Bold.ttf?inline';
import SarabunItalicDataUrl from '$lib/fonts/Sarabun/Sarabun-Italic.ttf?inline';
import SarabunBoldItalicDataUrl from '$lib/fonts/Sarabun/Sarabun-BoldItalic.ttf?inline';

const decodeDataUrlToBuffer = (dataUrl: string): Buffer => {
	const base64 = dataUrl.split(',')[1];
	return Buffer.from(base64, 'base64');
};

const Sarabun = {
	normal: decodeDataUrlToBuffer(SarabunRegularDataUrl),
	bold: decodeDataUrlToBuffer(SarabunBoldDataUrl),
	italics: decodeDataUrlToBuffer(SarabunItalicDataUrl),
	bolditalics: decodeDataUrlToBuffer(SarabunBoldItalicDataUrl)
};

export default Sarabun;
export { Sarabun };
