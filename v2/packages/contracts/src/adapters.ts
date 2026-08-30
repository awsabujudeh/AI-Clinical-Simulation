import type { RealUtcTime } from "./events.ts";
import type { JsonObject, JsonValue } from "./json.ts";

export interface ClockAdapter {
  nowUtc(): RealUtcTime;
}

// The concrete transaction request/result belongs to the consuming core package.
export interface PersistenceAdapter<
  TTransaction extends JsonObject,
  TResult extends JsonValue
> {
  transact(transaction: TTransaction): Promise<TResult>;
}

export interface StorageAdapter {
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, value: Uint8Array, metadata?: JsonObject): Promise<void>;
}

export const LogLevel = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR"
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LoggerAdapter {
  log(level: LogLevel, message: string, context?: JsonObject): void;
}

export interface RandomSeedAdapter {
  createSeed(): string;
}

export interface HashAdapter {
  sha256(value: string | Uint8Array): Promise<string>;
}
