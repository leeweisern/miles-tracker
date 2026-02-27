export interface Program {
  airline: string;
  alliance: string | null;
  created_at: string;
  id: string;
  name: string;
}

export interface AwardFlight {
  arrival_day_offset: number;
  arrival_time: string;
  available: boolean;
  cabin: "economy" | "business" | "first";
  cash_equivalent_myr: number | null;
  created_at: string;
  departure_date: string;
  departure_time: string;
  destination: string;
  duration_minutes: number;
  flight_number: string;
  id: number;
  notes: string | null;
  origin: string;
  points: number;
  program_id: string;
  route_type: string;
  scraped_at: string | null;
  seats_left: number | null;
  taxes_myr: number;
  tier: string;
  updated_at: string;
}

export interface FlightSearchMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface FlightSearchResult {
  data: AwardFlight[];
  meta: FlightSearchMeta;
}

export interface TierStats {
  available_count: number;
  avg_points: number;
  max_points: number;
  min_points: number;
}

export interface FlightStats {
  business: Record<string, TierStats> | null;
  date_range: {
    from: string | null;
    to: string | null;
  };
  destination: string;
  economy: Record<string, TierStats> | null;
  first: Record<string, TierStats> | null;
  origin: string;
  total_flights: number;
}

export interface SearchFilters {
  available_only?: boolean;
  cabin?: "economy" | "business" | "first";
  date_from?: string;
  date_to?: string;
  destination: string;
  limit?: number;
  offset?: number;
  origin?: string;
  points_max?: number;
  points_min?: number;
  program_id?: string;
  sort?: "date" | "points";
  tier?: string;
}
