import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/* -------------------------------------------------------
   TYPE DEFINITIONS
------------------------------------------------------- */
interface UploadData {
  data: Blob | ArrayBuffer;
  contentType: string;
}

/* -------------------------------------------------------
   UNIVERSAL IMAGE CONVERTER
   Handles Web (Blob) and Mobile (ArrayBuffer) properly
------------------------------------------------------- */
const convertImageForUpload = async (
  imageUriOrBlob: string | Blob
): Promise<UploadData> => {
  try {
    // 🌐 WEB PLATFORM
    if (Platform.OS === 'web') {
      if (imageUriOrBlob instanceof Blob) {
        return {
          data: imageUriOrBlob,
          contentType: imageUriOrBlob.type || 'image/jpeg',
        };
      }

      if (typeof imageUriOrBlob === 'string' && imageUriOrBlob.startsWith('data:')) {
        const response = await fetch(imageUriOrBlob);
        const blob = await response.blob();
        return {
          data: blob,
          contentType: blob.type || 'image/jpeg',
        };
      }

      if (typeof imageUriOrBlob === 'string' && imageUriOrBlob.startsWith('blob:')) {
        const response = await fetch(imageUriOrBlob);
        const blob = await response.blob();
        return {
          data: blob,
          contentType: blob.type || 'image/jpeg',
        };
      }

      throw new Error('Unsupported image format on web');
    }

    // 📱 MOBILE PLATFORMS (Android/iOS)
    if (typeof imageUriOrBlob !== 'string') {
      throw new Error('Mobile platforms expect file URI string');
    }

    console.log('📱 Starting image manipulation:', imageUriOrBlob);

    const manipulated = await ImageManipulator.manipulateAsync(
      imageUriOrBlob,
      [{ resize: { width: 1080 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    console.log('📱 Manipulated URI:', manipulated.uri);
    console.log('📱 Reading file as base64...');

    const base64String = await readAsStringAsync(manipulated.uri, {
      encoding: 'base64',
    });

    console.log('📱 Base64 length:', base64String.length);
    console.log('📱 Converting to ArrayBuffer...');

    const arrayBuffer = decode(base64String);

    console.log('📱 ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

    return {
      data: arrayBuffer,
      contentType: 'image/jpeg',
    };

  } catch (error) {
    console.error('❌ Image conversion error:', error);
    throw new Error(`Failed to convert image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/* -------------------------------------------------------
   MEMBER PHOTO UPLOAD
------------------------------------------------------- */
export const uploadMemberPhoto = async (
  imageUriOrBlob: string | Blob,
  userId: string
): Promise<string> => {
  try {
    console.log('👤 Starting member photo upload for user:', userId);
    console.log('👤 Platform:', Platform.OS);

    const { data, contentType } = await convertImageForUpload(imageUriOrBlob);

    const filePath = `profiles/${userId}/avatar.jpg`;
    console.log('👤 Upload path:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('gym-assets')
      .upload(filePath, data, {
        upsert: true,
        contentType,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('👤 Upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('gym-assets')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('👤 Upload successful:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('👤 Member photo upload failed:', error);
    throw error;
  }
};

/* -------------------------------------------------------
   GYM LOGO UPLOAD
------------------------------------------------------- */
export const uploadGymLogo = async (
  imageUriOrBlob: string | Blob,
  gymId: string
): Promise<string> => {
  try {
    console.log('🏢 Starting gym logo upload for gym:', gymId);
    console.log('🏢 Platform:', Platform.OS);

    const { data, contentType } = await convertImageForUpload(imageUriOrBlob);

    const filePath = `gym-logos/${gymId}/logo.jpg`;
    console.log('🏢 Upload path:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('gym-assets')
      .upload(filePath, data, {
        upsert: true,
        contentType,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('🏢 Upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('gym-assets')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('🏢 Upload successful:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('🏢 Gym logo upload failed:', error);
    throw error;
  }
};

/* -------------------------------------------------------
   DELETE MEMBER PHOTO
------------------------------------------------------- */
export const deleteMemberPhoto = async (userId: string): Promise<void> => {
  try {
    const filePath = `profiles/${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from('gym-assets')
      .remove([filePath]);

    if (error) throw error;
    console.log('👤 Photo deleted:', filePath);
  } catch (error) {
    console.error('👤 Delete failed:', error);
    throw error;
  }
};

/* -------------------------------------------------------
   DELETE GYM LOGO
------------------------------------------------------- */
export const deleteGymLogo = async (gymId: string): Promise<void> => {
  try {
    const filePath = `gym-logos/${gymId}/logo.jpg`;
    const { error } = await supabase.storage
      .from('gym-assets')
      .remove([filePath]);

    if (error) throw error;
    console.log('🏢 Logo deleted:', filePath);
  } catch (error) {
    console.error('🏢 Delete failed:', error);
    throw error;
  }
};