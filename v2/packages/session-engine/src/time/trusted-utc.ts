import {
  RealUtcTimeSchema,
  type RealUtcTime
} from "../../../contracts/src/index.ts";

const UTC_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const NANOSECONDS_PER_MILLISECOND = 1_000_000n;

function toEpochNanoseconds(value: RealUtcTime): bigint {
  const match = UTC_PARTS.exec(value);
  if (match === null) throw new Error("Validated UTC timestamp could not be decomposed.");
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const wholeSecond = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const epochMilliseconds = Date.parse(wholeSecond);
  if (!Number.isFinite(epochMilliseconds)) {
    throw new Error("Validated UTC timestamp could not be converted.");
  }
  const fractionNanoseconds = BigInt(`${fraction}000000000`.slice(0, 9));
  return BigInt(epochMilliseconds) * NANOSECONDS_PER_MILLISECOND + fractionNanoseconds;
}

function floorDiv(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function fromEpochNanoseconds(value: bigint): RealUtcTime | undefined {
  const epochSeconds = floorDiv(value, NANOSECONDS_PER_SECOND);
  const fractionNanoseconds = value - epochSeconds * NANOSECONDS_PER_SECOND;
  const milliseconds = Number(epochSeconds * 1000n);
  if (!Number.isSafeInteger(milliseconds)) return undefined;
  const wholeSecond = new Date(milliseconds).toISOString().slice(0, 19);
  const fractionText = fractionNanoseconds === 0n
    ? ""
    : `.${fractionNanoseconds.toString().padStart(9, "0").replace(/0+$/u, "")}`;
  const parsed = RealUtcTimeSchema.safeParse(`${wholeSecond}${fractionText}Z`);
  return parsed.success ? parsed.data : undefined;
}

export function compareTrustedUtc(left: RealUtcTime, right: RealUtcTime): number {
  const leftValue = toEpochNanoseconds(left);
  const rightValue = toEpochNanoseconds(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

export type TrustedElapsedSecondsResult =
  | { success: true; elapsed_seconds: number }
  | { success: false; reason: "REGRESSION" | "SUBSECOND_PRECISION" | "OVERFLOW" };

/** Computes explicit elapsed time; it never reads a runtime clock. */
export function elapsedWholeTrustedSeconds(
  anchor: RealUtcTime,
  requested: RealUtcTime
): TrustedElapsedSecondsResult {
  const difference = toEpochNanoseconds(requested) - toEpochNanoseconds(anchor);
  if (difference < 0n) return { success: false, reason: "REGRESSION" };
  if (difference % NANOSECONDS_PER_SECOND !== 0n) {
    return { success: false, reason: "SUBSECOND_PRECISION" };
  }
  const seconds = Number(difference / NANOSECONDS_PER_SECOND);
  return Number.isSafeInteger(seconds)
    ? { success: true, elapsed_seconds: seconds }
    : { success: false, reason: "OVERFLOW" };
}

/** Advances an explicit anchor; `Date` is formatting only and never a live clock. */
export function addTrustedRealSeconds(
  anchor: RealUtcTime,
  elapsedSeconds: number
): RealUtcTime | undefined {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return undefined;
  let wholeSeconds = Math.trunc(elapsedSeconds);
  if (!Number.isSafeInteger(wholeSeconds)) return undefined;
  let fractionNanoseconds = Math.round((elapsedSeconds - wholeSeconds) * 1_000_000_000);
  if (fractionNanoseconds === 1_000_000_000) {
    wholeSeconds += 1;
    fractionNanoseconds = 0;
  }
  const elapsedNanoseconds = BigInt(wholeSeconds) * NANOSECONDS_PER_SECOND
    + BigInt(fractionNanoseconds);
  return fromEpochNanoseconds(toEpochNanoseconds(anchor) + elapsedNanoseconds);
}
