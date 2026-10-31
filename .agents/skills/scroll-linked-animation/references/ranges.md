# View timeline ranges

Subject = the element with `view-timeline-name` or anonymous `view()`. Progress is how that subject moves through the scrollport.

## Named phases

| Token | Meaning (block axis, downward scroll) |
| --- | --- |
| `entry 0%` | Start edge hits the **end** of the scrollport (subject begins to enter from below) |
| `entry 100%` | Start edge hits the **start** of the scrollport (subject top flush with viewport top) |
| `exit 0%` | End edge hits the **end** of the scrollport (subject bottom flush with viewport bottom) |
| `exit 100%` | End edge leaves the **start** of the scrollport (subject fully gone upward) |
| `cover 0%` … `cover 100%` | From first intersection until subject fully leaves — good for parallax while visible |
| `contain 0%` … `contain 100%` | Only while subject is fully inside the scrollport — **useless** if subject taller than viewport |

## Sticky pin window

Track taller than `100vh`, child `position: sticky; top: 0; height: 100vh`:

- Pin **starts** ≈ `entry 100%` (track top at viewport top)
- Pin **ends** ≈ `exit 0%` (track bottom at viewport bottom)

→ `animation-range: entry 100% exit 0%` on the animated ancestor; timeline name on the **track**.

## Cover (parallax)

Subject roughly viewport-sized or media inside a clip:

→ `animation-range: cover 0% cover 100%` with anonymous `animation-timeline: view()` on the subject.
