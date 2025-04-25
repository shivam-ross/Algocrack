
'use server'
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation'

export async function AdminLogin(adminKey: string) {
  
    if(!adminKey) return {msg: "Admin key is required", success: false}
    
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const adminKeyhash = process.env.ADMIN_KEY_HASH!;
    
    const success = await bcrypt.compare(adminKey, adminKeyhash);

    if(!success) return {msg: "Invalid admin key", success: false};

    (await cookies()).set('admin-key', adminKey!)

    return redirect('/admin');
  
}
