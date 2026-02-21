import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Define schema types locally since we're using custom Zod parsing in the hook
import { z } from "zod";
import { orders, warnings } from "@shared/schema";

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await fetch(api.orders.list.path);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return api.orders.list.responses[200].parse(data);
    },
  });
}

export function useWarnings() {
  return useQuery({
    queryKey: [api.warnings.list.path],
    queryFn: async () => {
      const res = await fetch(api.warnings.list.path);
      if (!res.ok) throw new Error("Failed to fetch warnings");
      const data = await res.json();
      return api.warnings.list.responses[200].parse(data);
    },
  });
}
