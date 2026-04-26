import type { DayOfWeek } from "@/lib/schemas/promotion";

export function getTodayKey(d = new Date()): DayOfWeek {
  const js = d.getDay(); // 0 Sunday .. 6 Saturday
  switch (js) {
    case 0:
      return "sunday";
    case 1:
      return "monday";
    case 2:
      return "tuesday";
    case 3:
      return "wednesday";
    case 4:
      return "thursday";
    case 5:
      return "friday";
    default:
      return "saturday";
  }
}

export function formatDayEs(day: DayOfWeek) {
  const map: Record<DayOfWeek, string> = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo"
  };
  return map[day];
}

