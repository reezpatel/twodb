export abstract class Cypher<T extends object | string | Buffer> {
	abstract encrypt(data: T): string;

	abstract decrypt(data: string): T | null;
}

export class PlainTextCypher<
	T extends object | string | Buffer,
> extends Cypher<T> {
	encrypt(data: T): string {
		if (typeof data === "object") {
			if (Buffer.isBuffer(data)) {
				return `buffer::${data.toString("base64")}`;
			}
			return `object::${JSON.stringify(data)}`;
		}

		return `string::${data}`;
	}

	decrypt(data: string): T | null {
		try {
			if (data.startsWith("buffer::")) {
				return Buffer.from(data.slice(7), "base64") as T;
			}

			if (data.startsWith("string::")) {
				return data.slice(8) as T;
			}

			if (data.startsWith("object::")) {
				return JSON.parse(data.slice(8)) as T;
			}

			return null;
		} catch {
			return null;
		}
	}
}
