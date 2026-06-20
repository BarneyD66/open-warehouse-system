const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

function code128Values(value: string) {
  const normalized = value.replace(/[^\x20-\x7E]/g, "").slice(0, 64);
  const values = [104, ...normalized.split("").map((char) => char.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, current, index) => (index === 0 ? current : sum + current * index), 0) % 103;
  return [...values, checksum, 106];
}

function barcodeRects(value: string, height: number) {
  let x = 0;
  return code128Values(value).flatMap((code) => {
    const pattern = CODE128_PATTERNS[code] ?? "";
    return pattern.split("").flatMap((widthChar, index) => {
      const width = Number(widthChar);
      const rect = index % 2 === 0 ? [{ x, width, height }] : [];
      x += width;
      return rect;
    });
  });
}

export function Code128Barcode({ value, height = 72, moduleWidth = 2 }: { value: string; height?: number; moduleWidth?: number }) {
  const rects = barcodeRects(value, height);
  const width = Math.max(...rects.map((rect) => rect.x + rect.width), 1) * moduleWidth;

  return (
    <svg aria-label={`条码 ${value}`} className="w-full" role="img" viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      <rect fill="#fff" height={height} width={width} x="0" y="0" />
      {rects.map((rect, index) => (
        <rect fill="#020617" height={rect.height} key={`${rect.x}-${index}`} width={rect.width * moduleWidth} x={rect.x * moduleWidth} y="0" />
      ))}
    </svg>
  );
}
