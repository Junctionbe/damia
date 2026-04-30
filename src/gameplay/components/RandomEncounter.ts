/**
 * Tag component placed on mobs spawned by EncounterSystem (random encounters)
 * to distinguish them from scripted/placed mobs from MapLoader. EncounterSystem
 * uses this to enforce `maxConcurrentRandomMobs` without affecting hand-placed
 * encounters. Empty payload — its mere presence is the signal.
 */
export type RandomEncounter = Record<string, never>;
