// piexifjs não publica tipos; só o necessário para gravar EXIF sintético nos testes.
declare module 'piexifjs' {
  const piexif: {
    dump(exif: Record<string, Record<number, unknown>>): string;
    insert(exif: string, jpegBinario: string): string;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
  };
  export default piexif;
}
