import { get, writable } from "svelte/store";
import JSZip, { type JSZipObject } from "jszip";

const DB_NAME = "minecraft-cache";
const STORE_NAME = "jar-cache";

export interface JarInfo {
    id: string;
    name: string;
    timestamp: number;
    textureCount: number;
}


export const jarStatus = writable<"idle" | "downloading" | "cached">("idle");
export const jars = writable<JarInfo[]>([]);
export const zips = writable<JSZip[]>([]);

async function openDB() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function loadJarList() {
    try {
        const db = await openDB();
        return new Promise<JarInfo[]>((resolve) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = async () => {
                const keys = request.result as string[];
                const jarList: JarInfo[] = [];

                for (const key of keys) {
                    if (key.endsWith("-info")) {
                        const infoRequest = store.get(key);
                        await new Promise<void>((resolve) => {
                            infoRequest.onsuccess = () => {
                                if (infoRequest.result) {
                                    jarList.push(infoRequest.result);
                                }
                                resolve();
                            };
                            infoRequest.onerror = () => resolve();
                        });
                    }
                }

                jars.set(jarList);
                get(jars).map((jar) => unzipJar(jar.id).then((zip) => {
                    if (zip) {
                        zips.update((zips) => [...zips, zip])
                    }
                }));
                resolve(jarList);
            };

            request.onerror = () => {
                resolve([]);
            };
        });
    } catch (error) {
        console.error("Error loading jar list:", error);
        return [];
    }
}

export async function uploadJar(file: File): Promise<JarInfo | null> {
    try {
        jarStatus.set("downloading");

        const arrayBuffer = await file.arrayBuffer();
        const zip = new JSZip();
        const contents = await zip.loadAsync(arrayBuffer);

        // Count textures
        const textureCount = Object.keys(contents.files).filter(
            (path) =>
                path.startsWith("assets/") &&
                path.includes("textures/") &&
                path.endsWith(".png"),
        ).length;

        const jarInfo: JarInfo = {
            id: crypto.randomUUID(),
            name: file.name,
            timestamp: Date.now(),
            textureCount,
        };

        // Cache the jar and its info
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const request = store.put(arrayBuffer, jarInfo.id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise<void>((resolve, reject) => {
                const request = store.put(jarInfo, `${jarInfo.id}-info`);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
        ]);

        jars.update((list) => [...list, jarInfo]);
        zips.update((zips) => [...zips, zip]);
        jarStatus.set("cached");
        return jarInfo;
    } catch (error) {
        console.error("Error uploading jar:", error);
        jarStatus.set("idle");
        return null;
    }
}

export async function downloadAndCacheJar(
    url: string,
    name: string,
): Promise<JarInfo | null> {
    try {
        jarStatus.set("downloading");

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to download jar");

        const arrayBuffer = await response.arrayBuffer();
        const zip = new JSZip();
        const contents = await zip.loadAsync(arrayBuffer);

        // Count textures
        const textureCount = Object.keys(contents.files).filter(
            (path) =>
                path.startsWith("assets/minecraft/textures/") && path.endsWith(".png"),
        ).length;

        const jarInfo: JarInfo = {
            id: crypto.randomUUID(),
            name,
            timestamp: Date.now(),
            textureCount,
        };

        // Cache the jar and its info
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const request = store.put(arrayBuffer, jarInfo.id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise<void>((resolve, reject) => {
                const request = store.put(jarInfo, `${jarInfo.id}-info`);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
        ]);

        jars.update((list) => [...list, jarInfo]);
        zips.update((zips) => [...zips, zip]);
        jarStatus.set("cached");
        return jarInfo;
    } catch (error) {
        console.error("Error downloading and caching jar:", error);
        jarStatus.set("idle");
        return null;
    }
}

export async function getJarFromCache(
    jarId: string,
): Promise<ArrayBuffer | null> {
    try {
        const db = await openDB();
        return new Promise<ArrayBuffer | null>((resolve) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(jarId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    } catch (error) {
        console.error("Error getting jar from cache:", error);
        return null;
    }
}

export async function deleteJar(jarId: string): Promise<boolean> {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const request = store.delete(jarId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise<void>((resolve, reject) => {
                const request = store.delete(`${jarId}-info`);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
        ]);

        jars.update((list) => list.filter((jar) => jar.id !== jarId));
        zips.set([]);
        get(jars).map((jar) => unzipJar(jar.id).then((zip) => {
            if (zip) {
                zips.update((zips) => [...zips, zip])
            }
        }));
        return true;
    } catch (error) {
        console.error("Error deleting jar:", error);
        return false;
    }
}

export async function unzipJar(jarId: string): Promise<JSZip | undefined> {
    try {
        const jarData = await getJarFromCache(jarId);
        if (!jarData) {
            console.error("No jar file found in cache");
            return;
        }

        const zip = new JSZip();
        const contents = await zip.loadAsync(jarData);

        return contents;
    } catch (error) {
        console.error("Error unzipping jar file:", error);
    }
}

export async function findFile(path: string): Promise<JSZipObject | undefined> {
    for (const zip of get(zips)) {
        const file = zip.file(path);
        if (file) {
            return file;
        }
    }
    return undefined;
}

export async function loadJson(file: JSZipObject): Promise<unknown> {
    const data = await file.async("string");
    return JSON.parse(data);
}