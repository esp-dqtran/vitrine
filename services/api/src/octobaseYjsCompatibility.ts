type VarUint = {
  value: number;
  nextOffset: number;
};

function readVarUint(data: Uint8Array, offset: number): VarUint | undefined {
  let value = 0;
  let shift = 0;
  for (let index = offset; index < data.length && shift <= 28; index += 1) {
    const byte = data[index]!;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      return { value, nextOffset: index + 1 };
    }
    shift += 7;
  }
  return undefined;
}

function encodeVarUint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
}

export function octobaseGuidPrefixedUpdate(
  workspaceId: string,
  update: Uint8Array,
): Buffer {
  const guid = Buffer.from(workspaceId, "utf8");
  return Buffer.concat([encodeVarUint(guid.length), guid, Buffer.from(update)]);
}

function stripExpectedWorkspaceGuid(
  update: Uint8Array,
  workspaceId: string,
): Uint8Array | undefined {
  const guidLength = readVarUint(update, 0);
  if (!guidLength) return undefined;
  const guidEnd = guidLength.nextOffset + guidLength.value;
  if (guidEnd > update.length) return undefined;

  try {
    const guid = new TextDecoder("utf-8", { fatal: true }).decode(
      update.subarray(guidLength.nextOffset, guidEnd),
    );
    return guid === workspaceId ? update.subarray(guidEnd) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * OctoBase's legacy broadcast path stores the workspace GUID in front of a
 * valid Yjs update but frames that custom payload as a standard y-websocket
 * update. Remove only an exact, expected GUID prefix and preserve every other
 * frame byte-for-byte.
 */
export function translateOctobaseYjsFrame(
  frame: Uint8Array,
  workspaceId: string,
): Buffer {
  const messageType = readVarUint(frame, 0);
  if (!messageType || messageType.value !== 0) return Buffer.from(frame);

  const syncType = readVarUint(frame, messageType.nextOffset);
  if (!syncType || (syncType.value !== 1 && syncType.value !== 2)) {
    return Buffer.from(frame);
  }

  const updateLength = readVarUint(frame, syncType.nextOffset);
  if (!updateLength) return Buffer.from(frame);
  const updateEnd = updateLength.nextOffset + updateLength.value;
  if (updateEnd > frame.length) return Buffer.from(frame);

  const update = frame.subarray(updateLength.nextOffset, updateEnd);
  const translated = stripExpectedWorkspaceGuid(update, workspaceId);
  if (!translated) return Buffer.from(frame);

  return Buffer.concat([
    Buffer.from(frame.subarray(0, syncType.nextOffset)),
    encodeVarUint(translated.length),
    Buffer.from(translated),
    Buffer.from(frame.subarray(updateEnd)),
  ]);
}
