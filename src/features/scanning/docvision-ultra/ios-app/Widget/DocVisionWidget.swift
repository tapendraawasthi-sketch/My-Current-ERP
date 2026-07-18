import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), scans: [
            ScanItem(id: "1", title: "Receipt_001", date: "Today"),
            ScanItem(id: "2", title: "Contract_Signed", date: "Yesterday"),
            ScanItem(id: "3", title: "ID_Card", date: "Mon")
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), scans: [
            ScanItem(id: "1", title: "Receipt_001", date: "Today"),
            ScanItem(id: "2", title: "Contract_Signed", date: "Yesterday"),
            ScanItem(id: "3", title: "ID_Card", date: "Mon")
        ])
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []

        // Fetching latest scans from a local shared AppGroup/CoreData database would happen here
        let entry = SimpleEntry(date: Date(), scans: [
            ScanItem(id: "1", title: "Receipt_001", date: "Today"),
            ScanItem(id: "2", title: "Contract_Signed", date: "Yesterday"),
            ScanItem(id: "3", title: "ID_Card", date: "Mon")
        ])
        entries.append(entry)

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct ScanItem: Identifiable {
    let id: String
    let title: String
    let date: String
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let scans: [ScanItem]
}

struct DocVisionWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent Scans")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                Link(destination: URL(string: "docvision://scan")!) {
                    Image(systemName: "camera.fill")
                        .foregroundColor(.white)
                        .padding(6)
                        .background(Color.blue)
                        .clipShape(Circle())
                }
            }
            .padding(.bottom, 4)

            ForEach(entry.scans.prefix(3)) { scan in
                HStack {
                    Image(systemName: "doc.text")
                        .foregroundColor(.blue)
                    Text(scan.title)
                        .font(.subheadline)
                        .lineLimit(1)
                    Spacer()
                    Text(scan.date)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
        }
        .padding()
    }
}

@main
struct DocVisionWidget: Widget {
    let kind: String = "DocVisionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            DocVisionWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("DocVision Scans")
        .description("Quickly access your recent scans and jump straight to the camera.")
        .supportedFamilies([.systemMedium])
    }
}

struct DocVisionWidget_Previews: PreviewProvider {
    static var previews: some View {
        DocVisionWidgetEntryView(entry: SimpleEntry(date: Date(), scans: [
            ScanItem(id: "1", title: "Receipt_001", date: "Today"),
            ScanItem(id: "2", title: "Contract_Signed", date: "Yesterday"),
            ScanItem(id: "3", title: "ID_Card", date: "Mon")
        ]))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
