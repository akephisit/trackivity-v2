import SarabunRegularDataUrl from '$lib/fonts/Sarabun/Sarabun-Regular.ttf?inline';
import SarabunBoldDataUrl from '$lib/fonts/Sarabun/Sarabun-Bold.ttf?inline';
import SarabunItalicDataUrl from '$lib/fonts/Sarabun/Sarabun-Italic.ttf?inline';
import SarabunBoldItalicDataUrl from '$lib/fonts/Sarabun/Sarabun-BoldItalic.ttf?inline';

const decodeDataUrlToUint8Array = (dataUrl: string): Uint8Array => {
	const base64 = dataUrl.split(',')[1];
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
};

const Sarabun = {
	normal: decodeDataUrlToUint8Array(SarabunRegularDataUrl),
	bold: decodeDataUrlToUint8Array(SarabunBoldDataUrl),
	italics: decodeDataUrlToUint8Array(SarabunItalicDataUrl),
	bolditalics: decodeDataUrlToUint8Array(SarabunBoldItalicDataUrl)
};

export default Sarabun;
export { Sarabun };
