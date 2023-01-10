function getTime(): string {
  const padDigits = (num: number) => String(num).padStart(2, "0");
  const date = new Date();
  return `${padDigits(date.getHours())}:${padDigits(date.getMinutes())}:${padDigits(
    date.getSeconds()
  )}`
}

export default function serverLog(message: string) {
  console.log(
    `[${getTime()}]: ${message}`
  );
}
