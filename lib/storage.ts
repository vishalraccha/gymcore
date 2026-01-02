import { supabase } from './supabase';

export const uploadGymLogo = async (blob: Blob, gymId: string): Promise<string> => {
  try {
    const fileExt = 'jpg';
    const fileName = `gym-logo-${gymId}-${Date.now()}.${fileExt}`;
    const filePath = `gym-logos/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('gym-assets') // Make sure this bucket exists in Supabase
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('gym-assets')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload logo');
  }
};