import { useEffect, useState } from "react";

const fallback = "The nearest wildlings are Rag, Matthias and Litchy in Vienna, about 8,200 km away.";

const team = [
  { who: "Jake, Matt and Claire", place: "Washington DC", lat: 38.9, lng: -77.04 },
  { who: "Felix", place: "Los Angeles", lat: 34.05, lng: -118.24 },
  { who: "Anton", place: "the UK", lat: 51.51, lng: -0.13 },
  { who: "Monde", place: "South Africa", lat: -26.2, lng: 28.04 },
  { who: "Eva and David", place: "Spain", lat: 40.42, lng: -3.7 },
  { who: "Alex and Dom", place: "Italy", lat: 41.9, lng: 12.5 },
  { who: "Rag, Matthias and Litchy", place: "Vienna", lat: 48.21, lng: 16.37 },
  { who: "Leandro", place: "Argentina", lat: -34.6, lng: -58.38 },
];

function distanceBetween(latA, lngA, latB, lngB) {
  const radius = 6371;
  const radians = Math.PI / 180;
  const latDelta = Math.sin(((latB - latA) * radians) / 2);
  const lngDelta = Math.sin(((lngB - lngA) * radians) / 2);
  const value = latDelta ** 2
    + Math.cos(latA * radians) * Math.cos(latB * radians) * lngDelta ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function nearestCopy(latitude, longitude) {
  let nearest = null;
  let distance = Number.POSITIVE_INFINITY;

  team.forEach((member) => {
    const nextDistance = distanceBetween(latitude, longitude, member.lat, member.lng);
    if (nextDistance >= distance) return;
    distance = nextDistance;
    nearest = member;
  });

  if (!nearest) return fallback;
  const plural = nearest.who.includes(" and ");
  const distanceCopy = distance < 60
    ? "practically next door"
    : `about ${(distance < 1000
      ? Math.round(distance / 10) * 10
      : Math.round(distance / 100) * 100).toLocaleString()} km away`;

  return `The nearest wildling${plural ? "s are " : " is "}${nearest.who} in ${nearest.place}, ${distanceCopy}.`;
}

export function useNearestWildling() {
  const [copy, setCopy] = useState(fallback);

  useEffect(() => {
    const controller = new AbortController();

    fetch("https://ipwho.is/", { signal: controller.signal })
      .then((response) => response.json())
      .then((location) => {
        if (typeof location?.latitude !== "number" || typeof location?.longitude !== "number") return;
        setCopy(nearestCopy(location.latitude, location.longitude));
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return copy;
}
