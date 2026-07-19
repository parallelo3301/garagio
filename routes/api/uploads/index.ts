const maxUploadBytes = 10 * 1024 * 1024;

function extensionFor(file: File) {
  const extension = file.name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0].toLowerCase();
  return extension ?? ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.type] ?? '');
}

export const handler = {
  async POST(request: Request) {
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return Response.json({ error: 'Upload data must be multipart form data' }, { status: 400 });
    }
    const photos = data.getAll('photos').filter((value): value is File => value instanceof File);
    if (!photos.length) return Response.json({ error: 'Choose at least one photo' }, { status: 400 });
    if (photos.some((photo) => !photo.type.startsWith('image/') || photo.size > maxUploadBytes)) return Response.json({ error: 'Photos must be images no larger than 10 MB' }, { status: 400 });
    await Deno.mkdir(`${Deno.cwd()}/uploads`, { recursive: true });
    const paths: string[] = [];
    for (const photo of photos) {
      const filename = `${crypto.randomUUID()}${extensionFor(photo)}`;
      await Deno.writeFile(`${Deno.cwd()}/uploads/${filename}`, new Uint8Array(await photo.arrayBuffer()));
      paths.push(`/uploads/${filename}`);
    }
    return Response.json({ paths }, { status: 201 });
  },
};