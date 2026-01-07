import { supabase } from './supabase';

// ⭐ For gym logos (web only, works fine)
export const uploadGymLogo = async (blob: Blob, gymId: string): Promise<string> => {
  try {
    const fileExt = 'jpg';
    const fileName = `gym-logo-${gymId}-${Date.now()}.${fileExt}`;
    const filePath = `gym-logos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('gym-assets')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('gym-assets')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload logo');
  }
};

// ⭐ For member photos (works on web + mobile)
export const uploadMemberPhoto = async (blob: Blob, userId: string): Promise<string> => {
  try {
    console.log('📸 Uploading member photo for user:', userId);

    const timestamp = Date.now();
    const fileExtension = blob.type.includes('png') ? 'png' : 'jpg';
    const fileName = `member_${userId}_${timestamp}.${fileExtension}`;
    const filePath = `profiles/${fileName}`;

    console.log('📁 Filename:', fileName);

    const { data, error } = await supabase.storage
      .from('gym-assets')
      .upload(filePath, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }

    console.log('✅ Upload successful');

    const { data: { publicUrl } } = supabase.storage
      .from('gym-assets')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('✅ Public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ uploadMemberPhoto error:', error);
    throw error;
  }
};