import SwiftUI

// MARK: - Models

struct DocumentScan: Identifiable, Hashable {
    let id: UUID
    var title: String
    let date: Date
    let pageCount: Int
    let documentType: DocumentType
    let thumbnailName: String? // For simulation purposes
    
    enum DocumentType: String, CaseIterable {
        case receipt = "Receipt"
        case invoice = "Invoice"
        case idCard = "ID Card"
        case businessCard = "Business Card"
        case document = "Document"
        
        var color: Color {
            switch self {
            case .receipt: return .green
            case .invoice: return .blue
            case .idCard: return .orange
            case .businessCard: return .purple
            case .document: return .gray
            }
        }
    }
}

// MARK: - Simulation Data Store

class LibraryViewModel: ObservableObject {
    @Published var scans: [DocumentScan] = []
    @Published var searchText: String = ""
    @Published var selection = Set<UUID>()
    @Published var isEditMode: EditMode = .inactive
    @Published var showShareSheet = false
    @Published var itemsToShare: [Any] = []
    
    init() {
        loadSimulatedData()
    }
    
    var filteredScans: [DocumentScan] {
        if searchText.isEmpty {
            return scans
        } else {
            return scans.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.documentType.rawValue.localizedCaseInsensitiveContains(searchText) }
        }
    }
    
    func loadSimulatedData() {
        // Simulate Core Data / SQLite fetch
        let sampleData = [
            DocumentScan(id: UUID(), title: "Grocery Receipt", date: Date().addingTimeInterval(-86400 * 1), pageCount: 1, documentType: .receipt, thumbnailName: nil),
            DocumentScan(id: UUID(), title: "Q3 Invoice #1024", date: Date().addingTimeInterval(-86400 * 2), pageCount: 3, documentType: .invoice, thumbnailName: nil),
            DocumentScan(id: UUID(), title: "Driver's License", date: Date().addingTimeInterval(-86400 * 5), pageCount: 2, documentType: .idCard, thumbnailName: nil),
            DocumentScan(id: UUID(), title: "John Doe Contact", date: Date().addingTimeInterval(-86400 * 10), pageCount: 1, documentType: .businessCard, thumbnailName: nil),
            DocumentScan(id: UUID(), title: "Rental Agreement", date: Date().addingTimeInterval(-86400 * 15), pageCount: 8, documentType: .document, thumbnailName: nil)
        ]
        self.scans = sampleData.sorted(by: { $0.date > $1.date })
    }
    
    func deleteSelection() {
        scans.removeAll { selection.contains($0.id) }
        selection.removeAll()
        if scans.isEmpty {
            isEditMode = .inactive
        }
    }
    
    func prepareSharing() {
        let selectedScans = scans.filter { selection.contains($0.id) }
        // Simulate generating PDFs or Images for sharing
        let shareTexts = selectedScans.map { "Document: \($0.title) (\($0.documentType.rawValue))" }
        self.itemsToShare = shareTexts
        self.showShareSheet = true
    }
}

// MARK: - UIActivityViewController Representable

struct ShareSheet: UIViewControllerRepresentable {
    var items: [Any]
    var activities: [UIActivity]? = nil
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: activities)
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Library View

struct LibraryView: View {
    @StateObject private var viewModel = LibraryViewModel()
    
    let columns = [
        GridItem(.adaptive(minimum: 150), spacing: 16)
    ]
    
    var body: some View {
        NavigationView {
            ZStack {
                Color(UIColor.systemGroupedBackground)
                    .ignoresSafeArea()
                
                if viewModel.scans.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 64))
                            .foregroundColor(.gray)
                        Text("No Documents Found")
                            .font(.headline)
                        Text("Scan a new document to see it here.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(viewModel.filteredScans) { scan in
                                DocumentCardView(
                                    scan: scan,
                                    isSelected: viewModel.selection.contains(scan.id),
                                    isSelectionMode: viewModel.isEditMode == .active
                                ) {
                                    if viewModel.isEditMode == .active {
                                        toggleSelection(for: scan)
                                    } else {
                                        // Handle document tap (e.g., open viewer)
                                        print("Tapped \(scan.title)")
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Library")
            .searchable(text: $viewModel.searchText, prompt: "Search documents")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !viewModel.scans.isEmpty {
                        Button {
                            withAnimation {
                                if viewModel.isEditMode == .active {
                                    viewModel.isEditMode = .inactive
                                    viewModel.selection.removeAll()
                                } else {
                                    viewModel.isEditMode = .active
                                }
                            }
                        } label: {
                            Text(viewModel.isEditMode == .active ? "Done" : "Select")
                        }
                    }
                }
                
                if viewModel.isEditMode == .active {
                    ToolbarItem(placement: .bottomBar) {
                        HStack {
                            Button(role: .destructive) {
                                withAnimation {
                                    viewModel.deleteSelection()
                                }
                            } label: {
                                Image(systemName: "trash")
                            }
                            .disabled(viewModel.selection.isEmpty)
                            
                            Spacer()
                            
                            Text("\(viewModel.selection.count) Selected")
                                .font(.subheadline)
                            
                            Spacer()
                            
                            Button {
                                viewModel.prepareSharing()
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                            }
                            .disabled(viewModel.selection.isEmpty)
                        }
                    }
                }
            }
            .environment(\.editMode, $viewModel.isEditMode)
            .sheet(isPresented: $viewModel.showShareSheet) {
                ShareSheet(items: viewModel.itemsToShare)
            }
        }
    }
    
    private func toggleSelection(for scan: DocumentScan) {
        if viewModel.selection.contains(scan.id) {
            viewModel.selection.remove(scan.id)
        } else {
            viewModel.selection.insert(scan.id)
        }
    }
}

// MARK: - Document Card View

struct DocumentCardView: View {
    let scan: DocumentScan
    let isSelected: Bool
    let isSelectionMode: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                // Thumbnail Area
                ZStack(alignment: .topTrailing) {
                    Rectangle()
                        .fill(Color(UIColor.secondarySystemBackground))
                        .aspectRatio(3/4, contentMode: .fit)
                        .overlay(
                            Image(systemName: "doc.plaintext")
                                .font(.system(size: 40))
                                .foregroundColor(.gray.opacity(0.5))
                        )
                    
                    if isSelectionMode {
                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundColor(isSelected ? .blue : .gray)
                            .background(Circle().fill(Color.white))
                            .padding(8)
                    }
                }
                .clipped()
                
                // Metadata Area
                VStack(alignment: .leading, spacing: 6) {
                    Text(scan.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                        .foregroundColor(.primary)
                    
                    HStack {
                        Text(scan.date, style: .date)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(scan.pageCount) \(scan.pageCount == 1 ? "page" : "pages")")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    // Type Badge
                    Text(scan.documentType.rawValue)
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(scan.documentType.color.opacity(0.2))
                        .foregroundColor(scan.documentType.color)
                        .cornerRadius(4)
                }
                .padding(10)
                .background(Color(UIColor.systemBackground))
            }
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    LibraryView()
}
