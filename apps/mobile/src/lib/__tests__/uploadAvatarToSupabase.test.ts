import { uploadUserAvatarToSupabase } from "../uploadAvatarToSupabase";

describe("uploadUserAvatarToSupabase", () => {
  it("ajoute un query param de cache-bust à l’URL publique", async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: {
        publicUrl: "https://example.supabase.co/storage/v1/object/public/avatars/u1/technician/avatar.jpg"
      }
    });
    const supabase = {
      storage: {
        from: () => ({ upload, getPublicUrl })
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8)
    }) as unknown as typeof fetch;

    const url = await uploadUserAvatarToSupabase(
      supabase as never,
      "u1",
      "file:///tmp/photo.jpg",
      "image/jpeg",
      "technician"
    );

    expect(url).toMatch(
      /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/avatars\/u1\/technician\/avatar\.jpg\?v=\d+$/
    );
    expect(upload).toHaveBeenCalledWith(
      "u1/technician/avatar.jpg",
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true })
    );
  });
});
