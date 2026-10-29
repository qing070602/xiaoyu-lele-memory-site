/* Uses the MIT-licensed official Supabase client bundled in assets/vendor. */
(() => {
  "use strict";
  const config = window.SITE_CONFIG.cloud;
  const copy = window.SITE_CONFIG.copy.shared;
  const urls = new Map(), pending = new Map();
  let client, generation = 0;
  function connection() {
    if (!client) {
      if (!config.url || !config.publishableKey || !window.supabase) throw new Error(copy.notConfigured);
      client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { storage: sessionStorage, storageKey: "memory-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    return client;
  }
  function checked(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  function clear() {
    generation++;
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear(); pending.clear();
  }
  async function member() {
    const user = checked(await connection().auth.getUser()).user;
    if (!user) throw new Error(copy.loginRequired);
    const rows = checked(await connection().from("memory_members").select("display_name"));
    if (rows.length !== 1) throw new Error(copy.notMember);
    return { id: user.id, name: rows[0].display_name };
  }
  async function signOut() {
    clear();
    try { if (client) await client.auth.signOut({ scope: "local" }); }
    finally { sessionStorage.removeItem("memory-auth"); }
  }
  async function signIn(email, password) {
    checked(await connection().auth.signInWithPassword({ email, password }));
    try { return await member(); }
    catch (error) { await signOut(); throw error; }
  }
  async function restore() {
    const session = checked(await connection().auth.getSession()).session;
    return session ? member() : null;
  }
  async function load() {
    await member();
    const db = connection();
    const results = await Promise.all([
      db.from("memory_timeline").select("*").order("date", { ascending: true }).order("created_at", { ascending: true }),
      db.from("memory_photos").select("*").order("created_at", { ascending: false }),
      db.from("memory_letter").select("*").eq("id", 1).single()
    ]);
    return { timeline: checked(results[0]), photos: checked(results[1]), letter: checked(results[2]) };
  }
  async function save(table, values, previous) {
    const db = connection();
    const query = previous
      ? db.from(table).update(values).eq("id", previous.id).eq("revision", previous.revision).select("*")
      : db.from(table).insert(values).select("*");
    const rows = checked(await query);
    if (rows.length !== 1) throw new Error(copy.conflict);
    return rows[0];
  }
  async function photoUrl(photo) {
    const path = photo.storage_path, token = generation;
    if (urls.has(path)) return urls.get(path);
    if (!pending.has(path)) {
      const request = connection().storage.from(config.bucket).download(path).then(result => {
        const blob = checked(result);
        if (token !== generation) throw new Error(copy.loginRequired);
        const url = URL.createObjectURL(blob); urls.set(path, url); return url;
      }).finally(() => { if (token === generation) pending.delete(path); });
      pending.set(path, request);
    }
    return pending.get(path);
  }
  async function uploadPhoto(file, values) {
    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = extensions[file?.type];
    if (!ext || file.size > config.maxPhotoBytes || file.size === 0) throw new Error(copy.photoTypeError);
    // Decode before sending. SVG, HEIC and files merely renamed to .jpg are rejected.
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error(copy.photoTypeError); }
    bitmap.close();
    const path = `photos/${crypto.randomUUID()}.${ext}`;
    const bucket = connection().storage.from(config.bucket);
    checked(await bucket.upload(path, file, { contentType: file.type, upsert: false }));
    try { return await save("memory_photos", { ...values, storage_path: path }); }
    catch (error) {
      // The database policy only permits deleting unreferenced uploads. A lost
      // insert response cannot cause a successfully saved photo to be removed.
      await bucket.remove([path]).catch(() => {});
      throw error;
    }
  }
  function onSignedOut(callback) {
    connection().auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") setTimeout(callback, 0);
    });
  }
  function message(error) {
    if (Object.values(copy).includes(error?.message)) return error.message;
    if (error?.code === "invalid_credentials" || (error?.name === "AuthApiError" && error?.status === 400)) return copy.loginError;
    if (error?.status === 401 || error?.code === "PGRST301") return copy.loginRequired;
    return copy.networkError;
  }
  window.MemoryCloud = { signIn, restore, signOut, load, save, photoUrl, uploadPhoto, onSignedOut, clear, message };
})();
