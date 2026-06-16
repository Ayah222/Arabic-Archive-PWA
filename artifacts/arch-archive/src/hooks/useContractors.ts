import { useState, useEffect } from "react";
import { Contractor } from "../types";
import { mockContractors } from "../data/mockData";

// Module-level store — persists across navigation within the same session
let _store: Contractor[] = [...mockContractors];
let _subs: Array<() => void> = [];

const notify = () => _subs.forEach((fn) => fn());

export const contractorsStore = {
  getAll: () => _store,
  add: (c: Contractor) => {
    _store = [..._store, c];
    notify();
  },
  update: (c: Contractor) => {
    _store = _store.map((x) => (x.id === c.id ? c : x));
    notify();
  },
  remove: (id: string) => {
    _store = _store.filter((x) => x.id !== id);
    notify();
  },
};

export function useContractors() {
  const [contractors, setContractors] = useState<Contractor[]>(_store);

  useEffect(() => {
    const sync = () => setContractors([..._store]);
    _subs.push(sync);
    setContractors([..._store]);
    return () => {
      _subs = _subs.filter((s) => s !== sync);
    };
  }, []);

  return {
    contractors,
    addContractor: contractorsStore.add,
    updateContractor: contractorsStore.update,
    removeContractor: contractorsStore.remove,
  };
}
