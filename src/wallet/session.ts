import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import { paths } from "../utils/config.js";
import { ErrorCode, FibxError } from "../utils/errors.js";

const sessionSchema = z.object({
	userId: z.string().optional(),
	walletId: z.string(),
	walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	authorizationPublicKey: z.string(),
	createdAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

function getSessionPath(): string {
	return join(paths.config, "session.json");
}

export function loadSession(): Session | null {
	try {
		const raw = readFileSync(getSessionPath(), "utf-8");
		const result = sessionSchema.safeParse(JSON.parse(raw));
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function requireSession(): Session {
	const session = loadSession();
	if (!session) {
		throw new FibxError(
			ErrorCode.NOT_AUTHENTICATED,
			"Not authenticated. Run `fibx auth login <email>` first."
		);
	}
	return session;
}

export function saveSession(session: Session): void {
	const filePath = getSessionPath();
	mkdirSync(dirname(filePath), { recursive: true });
	sessionSchema.parse(session);
	writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
}

export function clearSession(): void {
	try {
		unlinkSync(getSessionPath());
	} catch {
		// Already cleared
	}
}
