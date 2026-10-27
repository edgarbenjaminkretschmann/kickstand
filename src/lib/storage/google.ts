// Placeholder for the move to Google (see docs/MIGRATION-GOOGLE.md).
import type { StorageAdapter } from "./types";

export class GoogleCloudStorage implements StorageAdapter {
  constructor(readonly bucket: string) {}

  save(): Promise<string> {
    throw new Error("GoogleCloudStorage.save: not implemented");
  }

  read(): Promise<Buffer | null> {
    throw new Error("GoogleCloudStorage.read: not implemented");
  }

  delete(): Promise<void> {
    throw new Error("GoogleCloudStorage.delete: not implemented");
  }
}
