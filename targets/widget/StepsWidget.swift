import SwiftUI
import WidgetKit

// Must match APP_GROUP in src/constants/app.ts; the app writes these keys after every sync.
private let appGroup = "group.com.neutcrafts.steps"

struct StepsEntry: TimelineEntry {
  let date: Date
  let steps: Int
  let goal: Int
  let updatedAt: Date?

  var progress: Double {
    goal > 0 ? min(1, Double(steps) / Double(goal)) : 0
  }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> StepsEntry {
    StepsEntry(date: .now, steps: 5230, goal: 7000, updatedAt: .now)
  }

  func getSnapshot(in context: Context, completion: @escaping (StepsEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : read())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StepsEntry>) -> Void) {
    // The app reloads the widget after each sync; this is only a fallback refresh.
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now.addingTimeInterval(1800)
    completion(Timeline(entries: [read()], policy: .after(next)))
  }

  private func read() -> StepsEntry {
    let defaults = UserDefaults(suiteName: appGroup)
    let stamp = defaults?.double(forKey: "updatedAt") ?? 0
    let updatedAt = stamp > 0 ? Date(timeIntervalSince1970: stamp) : nil
    var steps = defaults?.integer(forKey: "steps") ?? 0
    // Yesterday's count is not today's: show zero until the app syncs again.
    if let updatedAt, !Calendar.current.isDateInToday(updatedAt) { steps = 0 }
    return StepsEntry(date: .now, steps: steps, goal: defaults?.integer(forKey: "goal") ?? 0, updatedAt: updatedAt)
  }
}

struct Ring: View {
  let progress: Double
  let lineWidth: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(Color.secondary.opacity(0.25), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: progress)
        .stroke(Color.accentColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

struct StepsWidgetView: View {
  let entry: StepsEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      if family == .systemSmall {
        VStack(alignment: .leading, spacing: 6) {
          Ring(progress: entry.progress, lineWidth: 7).frame(width: 44, height: 44)
          Spacer(minLength: 0)
          Text(entry.steps.formatted()).font(.title2).bold().monospacedDigit().minimumScaleFactor(0.6)
          Text(goalText).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        HStack(spacing: 14) {
          Ring(progress: entry.progress, lineWidth: 9).frame(width: 72, height: 72)
          VStack(alignment: .leading, spacing: 2) {
            Text("Today").font(.caption).foregroundStyle(.secondary)
            Text(entry.steps.formatted()).font(.title).bold().monospacedDigit()
            Text(goalText).font(.caption).foregroundStyle(.secondary)
          }
          Spacer(minLength: 0)
        }
      }
    }
    .containerBackground(for: .widget) { Color("WidgetBackground") }
  }

  private var goalText: String {
    entry.goal > 0 ? "of \(entry.goal.formatted()) · \(Int(entry.progress * 100))%" : "Open the app to start"
  }
}

struct StepsWidget: Widget {
  // Must match IOS_WIDGET_KIND in src/constants/app.ts.
  let kind = "StepsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      StepsWidgetView(entry: entry)
    }
    .configurationDisplayName("Steps today")
    .description("Today's steps and your goal.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct StepsWidgetBundle: WidgetBundle {
  var body: some Widget {
    StepsWidget()
  }
}
