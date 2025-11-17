import { supabase } from '@/integrations/supabase/client';

const MAX_OPS_PER_SEC = 10;

function throttle(fn, limitPerSec) {
  let tokens = limitPerSec;
  let last = Date.now();
  return (...args) => {
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed >= 1000) {
      tokens = limitPerSec;
      last = now;
    }
    if (tokens > 0) {
      tokens -= 1;
      fn(...args);
    }
  };
}

function objectToSerializable(obj) {
  try {
    const json = obj.toObject ? obj.toObject(['id']) : obj;
    // remove heavy properties
    delete json.filters;
    return json;
  } catch {
    return {};
  }
}

export function attachPatchSenders({ canvas, projectId, pageId, user }) {
  const clientId = crypto.randomUUID();
  const base = { project_id: projectId, user_id: user?.id, username: user?.username };

  const send = async (op_type, obj, extra = {}) => {
    if (!canvas || !projectId || !user?.id) return;
    if (op_type === 'transform') {
      // throttled
      throttledSend(op_type, obj, extra);
      return;
    }
    const object_id = obj?.id || crypto.randomUUID();
    if (obj && !obj.id) obj.id = object_id; // ensure stable id
    const payload = {
      ...extra,
      object: obj ? objectToSerializable(obj) : undefined,
      client_id: clientId,
    };
    const patch = {
      id: crypto.randomUUID(),
      ...base,
      page_id: pageId || null,
      op_type,
      object_id,
      payload,
    };
    await supabase.from('project_live_updates').insert(patch);
  };

  const throttledSend = throttle(async (op_type, obj, extra = {}) => {
    const object_id = obj?.id || crypto.randomUUID();
    if (obj && !obj.id) obj.id = object_id;
    const payload = { ...extra, object: objectToSerializable(obj), client_id: clientId };
    const patch = {
      id: crypto.randomUUID(),
      project_id: projectId,
      page_id: pageId || null,
      user_id: user?.id,
      username: user?.username,
      op_type,
      object_id,
      payload,
    };
    await supabase.from('project_live_updates').insert(patch);
  }, MAX_OPS_PER_SEC);

  const onAdded = ({ target }) => send('add', target);
  const onRemoved = ({ target }) => send('remove', target);
  const onModified = ({ target }) => send('modify', target, { props: target ? target.toObject(['id']) : {} });
  const onMoving = ({ target }) => send('transform', target, { props: { left: target.left, top: target.top }, coords: true });
  const onScaling = ({ target }) => send('transform', target, { props: { scaleX: target.scaleX, scaleY: target.scaleY }, coords: true });
  const onRotating = ({ target }) => send('transform', target, { props: { angle: target.angle }, coords: true });

  canvas.on('object:added', onAdded);
  canvas.on('object:removed', onRemoved);
  canvas.on('object:modified', onModified);
  canvas.on('object:moving', onMoving);
  canvas.on('object:scaling', onScaling);
  canvas.on('object:rotating', onRotating);

  return () => {
    canvas.off('object:added', onAdded);
    canvas.off('object:removed', onRemoved);
    canvas.off('object:modified', onModified);
    canvas.off('object:moving', onMoving);
    canvas.off('object:scaling', onScaling);
    canvas.off('object:rotating', onRotating);
  };
}

// Send an arbitrary patch (e.g., media timeline ops) to the realtime channel
export async function sendPatch({ projectId, pageId, patch, user }) {
  try {
    if (!projectId || !user?.id) return;
    const clientId = crypto.randomUUID();
    const row = {
      id: crypto.randomUUID(),
      project_id: projectId,
      page_id: pageId || null,
      user_id: user?.id,
      username: user?.username,
      op_type: patch?.op_type,
      object_id: patch?.object_id || null,
      payload: { ...(patch?.payload || {}), client_id: clientId },
    };
    await supabase.from('project_live_updates').insert(row);
  } catch (e) {
    console.error('sendPatch error', e);
  }
}