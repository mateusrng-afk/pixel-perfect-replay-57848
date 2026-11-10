import { describe, expect, it } from "vitest";
import { availableSlots, totalPrice } from "./schedule";
import { SEED_SERVICES, SEED_HOURS } from "./seed";
import type { Appointment } from "./types";

const monday = new Date(2030, 0, 7); // segunda-feira
const sunday = new Date(2030, 0, 6);
const longAgo = new Date(2020, 0, 1, 12, 0);

function appt(start: string, end: string, status: Appointment["status"] = "pending") {
  return { start_time: start, end_time: end, status };
}

describe("preços dos serviços", () => {
  const price = (name: string) => SEED_SERVICES.find((s) => s.name === name)!.price;

  it("tem os valores da tabela da barbearia", () => {
    expect(price("Corte")).toBe(30);
    expect(price("Barba")).toBe(20);
    expect(price("Pigmentação")).toBe(15);
    expect(price("Corte + barba")).toBe(50);
    expect(price("Barba + pezinho")).toBe(25);
    expect(price("Pezinho")).toBe(5);
    expect(price("Sobrancelha")).toBe(5);
    expect(price("Luzes")).toBe(65);
    expect(price("Nevou")).toBe(100);
  });

  it("soma o total de vários serviços", () => {
    expect(totalPrice([{ price: 30 }, { price: 5 }, { price: 15 }])).toBe(50);
  });
});

describe("horários disponíveis", () => {
  it("domingo é fechado", () => {
    expect(availableSlots({ date: sunday, hours: SEED_HOURS, appointments: [], duration: 30, now: longAgo })).toEqual([]);
  });

  it("segunda abre às 08:00 e o último horário de 30 min é 18:30", () => {
    const slots = availableSlots({ date: monday, hours: SEED_HOURS, appointments: [], duration: 30, now: longAgo });
    expect(slots[0]).toBe("08:00");
    expect(slots.at(-1)).toBe("18:30");
    expect(slots).toHaveLength(22);
  });

  it("procedimento de 60 min precisa terminar até 19:00", () => {
    const slots = availableSlots({ date: monday, hours: SEED_HOURS, appointments: [], duration: 60, now: longAgo });
    expect(slots.at(-1)).toBe("18:00");
  });

  it("horário ocupado não é oferecido novamente", () => {
    const slots = availableSlots({
      date: monday,
      hours: SEED_HOURS,
      appointments: [appt("09:00", "10:00")],
      duration: 60,
      now: longAgo,
    });
    expect(slots).not.toContain("08:30");
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30");
    expect(slots).toContain("08:00");
    expect(slots).toContain("10:00");
  });

  it("agendamento cancelado libera o horário", () => {
    const slots = availableSlots({
      date: monday,
      hours: SEED_HOURS,
      appointments: [appt("09:00", "10:00", "cancelled")],
      duration: 30,
      now: longAgo,
    });
    expect(slots).toContain("09:00");
  });

  it("não oferece horários que já passaram hoje", () => {
    const now = new Date(2030, 0, 7, 14, 10);
    const slots = availableSlots({ date: monday, hours: SEED_HOURS, appointments: [], duration: 30, now });
    expect(slots[0]).toBe("14:30");
  });
});
