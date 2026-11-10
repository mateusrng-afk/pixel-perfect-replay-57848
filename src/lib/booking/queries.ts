import { queryOptions } from "@tanstack/react-query";
import * as repo from "./repo";
import type { AppointmentFilter } from "./types";

export const barbersQuery = queryOptions({ queryKey: ["barbers"], queryFn: repo.listBarbers });
export const servicesQuery = queryOptions({ queryKey: ["services"], queryFn: repo.listServices });
export const barberServicesQuery = queryOptions({
  queryKey: ["barber_services"],
  queryFn: repo.listBarberServices,
});
export const businessHoursQuery = queryOptions({
  queryKey: ["business_hours"],
  queryFn: repo.listBusinessHours,
});
export const appointmentsQuery = (filter: AppointmentFilter = {}) =>
  queryOptions({
    queryKey: ["appointments", filter],
    queryFn: () => repo.listAppointments(filter),
  });
export const busyTimesQuery = (barberId: string, date: string) =>
  queryOptions({
    queryKey: ["busy", barberId, date],
    queryFn: () => repo.listBusyTimes(barberId, date),
  });
