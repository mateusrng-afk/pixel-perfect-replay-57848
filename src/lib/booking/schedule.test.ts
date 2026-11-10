import { describe, expect, it } from "vitest";
import {
  availableSlots,
  barbersForService,
  hoursForBarber,
  servicesForBarber,
  shopHours,
  totalDuration,
  totalPrice,
} from "./schedule";
import type { BusinessHour, BusyTime } from "./types";

const monday = new Date(2030, 0, 7); // segunda-feira
const sunday = new Date(2030, 0, 6);
const longAgo = new Date(2020, 0, 1, 12, 0);

// Mon–Sat 08:00–19:00, Sunday closed (as in the barbershop's database)
const HOURS: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  barber_id: "genario",
  day_of_week: d,
  open_time: "08:00",
  close_time: "19:00",
  is_closed: d === 0,
}));

function busy(start: string, end: string, status: BusyTime["status"] = "pending"): BusyTime {
  return { start_time: start, end_time: end, status };
}

describe("totais", () => {
  it("soma preço e duração de vários serviços", () => {
    const corte = { price: 30, duration_minutes: 30 };
    const pezinho = { price: 5, duration_minutes: 10 };
    const pigmentacao = { price: 15, duration_minutes: 15 };
    expect(totalPrice([corte, pezinho, pigmentacao])).toBe(50);
    expect(totalDuration([corte, pezinho, pigmentacao])).toBe(55);
  });
});

describe("horários disponíveis", () => {
  it("domingo é fechado", () => {
    expect(availableSlots({ date: sunday, hours: HOURS, appointments: [], duration: 30, now: longAgo })).toEqual([]);
  });

  it("segunda abre às 08:00 e o último horário de 30 min é 18:30", () => {
    const slots = availableSlots({ date: monday, hours: HOURS, appointments: [], duration: 30, now: longAgo });
    expect(slots[0]).toBe("08:00");
    expect(slots.at(-1)).toBe("18:30");
    expect(slots).toHaveLength(22);
  });

  it("procedimento de 2h (Nevou) precisa terminar até 19:00", () => {
    const slots = availableSlots({ date: monday, hours: HOURS, appointments: [], duration: 120, now: longAgo });
    expect(slots.at(-1)).toBe("17:00");
  });

  it("horário ocupado não é oferecido novamente", () => {
    const slots = availableSlots({ date: monday, hours: HOURS, appointments: [busy("09:00", "10:00")], duration: 60, now: longAgo });
    expect(slots).not.toContain("08:30");
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30");
    expect(slots).toContain("08:00");
    expect(slots).toContain("10:00");
  });

  it("agendamento cancelado libera o horário", () => {
    const slots = availableSlots({ date: monday, hours: HOURS, appointments: [busy("09:00", "10:00", "cancelled")], duration: 30, now: longAgo });
    expect(slots).toContain("09:00");
  });

  it("não oferece horários que já passaram hoje", () => {
    const now = new Date(2030, 0, 7, 14, 10);
    const slots = availableSlots({ date: monday, hours: HOURS, appointments: [], duration: 30, now });
    expect(slots[0]).toBe("14:30");
  });
});

describe("horários por barbeiro", () => {
  it("usa os horários do próprio barbeiro e completa com os da barbearia", () => {
    const shared: BusinessHour = { barber_id: null, day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false };
    const own: BusinessHour = { barber_id: "mateus", day_of_week: 2, open_time: "10:00", close_time: "17:00", is_closed: false };
    const result = hoursForBarber([shared, own, ...HOURS], "mateus");
    expect(result).toEqual([own, shared]);
  });

  it("mostra um horário por dia da semana para a barbearia toda", () => {
    const twoBarbers = [...HOURS, ...HOURS.map((h) => ({ ...h, barber_id: "devanio" }))];
    expect(shopHours(twoBarbers).map((h) => h.day_of_week)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("serviços por barbeiro", () => {
  const services = [{ id: "corte" }, { id: "luzes" }];

  it("serviço sem barbeiros vinculados é feito por todos", () => {
    expect(servicesForBarber(services, [], "genario")).toEqual(services);
    expect(barbersForService("corte", [], ["genario", "mateus"])).toEqual(["genario", "mateus"]);
  });

  it("serviço vinculado só aparece para os barbeiros escolhidos", () => {
    const links = [{ barber_id: "mateus", service_id: "luzes" }];
    expect(servicesForBarber(services, links, "genario")).toEqual([{ id: "corte" }]);
    expect(servicesForBarber(services, links, "mateus")).toEqual(services);
  });
});
