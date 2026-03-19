import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import { paths } from "../../lib/config.js";
import { ErrorCode, FibxError } from "../../lib/errors.js";

const sessionSchema = z.object({
	userId: z.string().optional(),
	walletId: z.string().optional(), // Optional for private-key auth
	walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	userJwt: z.string().optional(),
	createdAt: z.string(),
	type: z.enum(["privy", "private-key"]).default("privy"),
	privateKey: z.string().optional(), // Only for private-key auth
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

	if (session.userJwt && isSessionExpired(session.userJwt)) {
		clearSession();
		throw new FibxError(
			ErrorCode.SESSION_EXPIRED,
			"Session expired. Run `fibx auth login <email>` again."
		);
	}

	return session;
}

// Decode JWT payload (no signature verification — client-side expiry check only).
function isSessionExpired(token: string): boolean {
	try {
		const parts = token.split(".");
		if (parts.length !== 3 || !parts[1]) return false;

		const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as {
			exp?: number;
		};
		if (!payload.exp) return false;

		// Buffer before actual expiry to avoid mid-request failures
		const SESSION_EXPIRY_BUFFER_SECONDS = 300;
		return Date.now() >= (payload.exp - SESSION_EXPIRY_BUFFER_SECONDS) * 1000;
	} catch {
		return false;
	}
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
		// noop
	}
}
