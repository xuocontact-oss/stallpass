"use client"

import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet"

export type MapPin = {
  slug: string
  name: string
  lat: number
  lng: number
  subtitle: string
}

/** OpenStreetMap map with one dot per market. Free, no account needed. */
export default function MarketMap({
  pins,
  center,
  origin,
}: {
  pins: MapPin[]
  center: { lat: number; lng: number }
  origin: { lat: number; lng: number } | null
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={origin ? 11 : 10}
      scrollWheelZoom={false}
      className="h-[65vh] min-h-[360px] w-full rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={7}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 }}
        >
          <Popup>Measuring distance from here</Popup>
        </CircleMarker>
      )}
      {pins.map((p) => (
        <CircleMarker
          key={p.slug}
          center={[p.lat, p.lng]}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#c7402b", fillOpacity: 1 }}
        >
          <Popup>
            <Link href={`/markets/${p.slug}`} className="font-semibold">
              {p.name}
            </Link>
            <br />
            {p.subtitle}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
