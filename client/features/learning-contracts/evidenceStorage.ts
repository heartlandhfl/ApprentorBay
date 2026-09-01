import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { evidenceStoragePath } from '@apprentorbay/shared';
import { getFirebaseStorage } from '../../lib/firebase';

export async function uploadEvidenceFile(input: {
  contractId: string;
  milestoneId: string;
  userId: string;
  file: File;
}): Promise<{ storagePath: string; fileName: string }> {
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error('File storage is not available');
  }
  const fileId = `${Date.now()}-${input.file.name.replace(/[^\w.\-]+/g, '_')}`;
  const storagePath = evidenceStoragePath({
    contractId: input.contractId,
    milestoneId: input.milestoneId,
    userId: input.userId,
    fileId,
  });
  await uploadBytes(ref(storage, storagePath), input.file, {
    contentType: input.file.type || 'application/octet-stream',
  });
  return { storagePath, fileName: input.file.name };
}

export async function evidenceDownloadUrl(storagePath: string): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error('File storage is not available');
  }
  return getDownloadURL(ref(storage, storagePath));
}
