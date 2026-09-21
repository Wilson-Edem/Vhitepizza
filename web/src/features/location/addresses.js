import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const addressesOf = (uid) => collection(db, "users", uid, "addresses");

// Saved addresses, default first, then newest first.
export async function listAddresses(uid) {
  const snapshot = await getDocs(addressesOf(uid));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort(
      (a, b) =>
        Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) ||
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
}

// Only these fields are saved.
export async function saveAddress(uid, address, label = "", isDefault = false) {
  const created = await addDoc(addressesOf(uid), {
    label: label.trim().slice(0, 40),
    formattedAddress: address.formattedAddress,
    lat: address.lat ?? null,
    lng: address.lng ?? null,
    phone: address.phone,
    landmark: address.landmark || "",
    notes: address.notes || "",
    source: address.source || "manual",
    isDefault,
    createdAt: serverTimestamp(),
  });

  if (isDefault) await setDefaultAddress(uid, created.id);

  return created.id;
}

export async function deleteAddress(uid, addressId) {
  await deleteDoc(doc(db, "users", uid, "addresses", addressId));
}

// Makes one address the default and clears the flag on all the others.
export async function setDefaultAddress(uid, addressId) {
  const snapshot = await getDocs(addressesOf(uid));
  const batch = writeBatch(db);

  snapshot.docs.forEach((item) =>
    batch.update(item.ref, { isDefault: item.id === addressId })
  );

  await batch.commit();
}
