import CalendarDayButton from './CalendarDayButton';

const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

export default function CalendarGrid({
    days,
    isDateSelected,
    isDateInRange,
    hasTaskOnDate,
    onDateClick,
}) {
    return (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {dayNames.map((day) => (
                <div
                    key={day}
                    className="py-2 text-center text-xs font-semibold text-slate-600 sm:text-sm"
                >
                    {day}
                </div>
            ))}

            {days.map((day, index) => {
                const isSelected = isDateSelected(day.date);
                const inRange = isDateInRange(day.date);
                const hasTask = hasTaskOnDate(day.date);
                const isToday = day.date.toDateString() === new Date().toDateString();

                return (
                    <CalendarDayButton
                        key={index}
                        day={day}
                        isSelected={isSelected}
                        inRange={inRange}
                        isToday={isToday}
                        hasTask={hasTask}
                        onClick={() => onDateClick(day.date)}
                    />
                );
            })}
        </div>
    );
}