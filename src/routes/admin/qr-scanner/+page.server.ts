import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';

export const load: PageServerLoad = async (event) => {
  const user = requireAdmin(event);

  // QR Scanner page - ไม่จำเป็นต้องโหลดข้อมูลเพิ่มเติม
  // การสแกน QR จะทำผ่าน client-side JavaScript

  return { 
    user
  };
};