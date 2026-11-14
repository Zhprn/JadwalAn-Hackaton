import prisma from '../../lib/prisma';
import type { Usage } from './gemini';

export type AiLogInput = {
  feature: string;
  model: string;
  input?: unknown;
  output?: unknown;
  toolCalls?: unknown;
  usage?: Usage;
  latencyMs: number;
  status: 'success' | 'error' | 'handoff';
  errorMessage?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
};

const json = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Simpan log pemanggilan AI. Tidak melempar error supaya respons ke pelanggan tidak gagal. */
export const writeAiLog = async (l: AiLogInput) => {
  try {
    await prisma.aiLog.create({
      data: {
        feature: l.feature,
        model: l.model,
        input: json(l.input),
        output: json(l.output),
        toolCalls: json(l.toolCalls),
        promptTokens: l.usage?.promptTokens ?? 0,
        completionTokens: l.usage?.completionTokens ?? 0,
        latencyMs: Math.round(l.latencyMs),
        status: l.status,
        errorMessage: l.errorMessage ?? null,
        sessionId: l.sessionId ?? null,
        customerId: l.customerId ?? null,
      },
    });
  } catch (e) {
    console.error('Gagal menyimpan AiLog:', e);
  }
};
