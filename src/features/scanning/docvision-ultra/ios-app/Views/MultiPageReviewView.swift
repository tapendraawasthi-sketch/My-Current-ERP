import SwiftUI
import UniformTypeIdentifiers

public struct PageModel: Identifiable, Equatable {
    public let id = UUID()
    public let image: UIImage
    
    public init(image: UIImage) {
        self.image = image
    }
}

public struct MultiPageReviewView: View {
    @State private var pages: [PageModel]
    @State private var selectedPageId: UUID?
    @State private var draggedItem: PageModel?
    
    public var onAddPage: () -> Void
    public var onDone: ([UIImage]) -> Void
    
    public init(initialPages: [UIImage], onAddPage: @escaping () -> Void, onDone: @escaping ([UIImage]) -> Void) {
        let initialModels = initialPages.map { PageModel(image: $0) }
        _pages = State(initialValue: initialModels)
        _selectedPageId = State(initialValue: initialModels.first?.id)
        self.onAddPage = onAddPage
        self.onDone = onDone
    }
    
    private var selectedImage: UIImage? {
        pages.first(where: { $0.id == selectedPageId })?.image
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // Main Image Viewer
            ZStack {
                Color.black.edgesIgnoringSafeArea(.all)
                
                if let image = selectedImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .transition(.opacity)
                } else {
                    Text("No pages available.")
                        .foregroundColor(.gray)
                }
            }
            
            // Bottom Strip
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 16) {
                        ForEach(pages, id: \.id) { page in
                            ThumbnailView(
                                page: page,
                                isSelected: page.id == selectedPageId,
                                onDelete: {
                                    deletePage(page)
                                }
                            )
                            .onTapGesture {
                                withAnimation {
                                    selectedPageId = page.id
                                }
                            }
                            .onDrag {
                                self.draggedItem = page
                                return NSItemProvider(object: page.id.uuidString as NSString)
                            }
                            .onDrop(of: [UTType.plainText], delegate: PageDropDelegate(item: page, items: $pages, draggedItem: $draggedItem))
                        }
                    }
                    .padding()
                }
                .frame(height: 160)
                .background(Color(UIColor.systemGray6))
                
                // Action Bar
                HStack {
                    Button(action: onAddPage) {
                        HStack {
                            Image(systemName: "plus.viewfinder")
                            Text("Add Page")
                        }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.blue)
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(10)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        onDone(pages.map { $0.image })
                    }) {
                        Text("Done")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .background(Color.blue)
                            .cornerRadius(10)
                    }
                }
                .padding()
                .background(Color(UIColor.systemBackground))
            }
        }
    }
    
    private func deletePage(_ page: PageModel) {
        withAnimation {
            if let index = pages.firstIndex(of: page) {
                pages.remove(at: index)
                
                // Update selected image if needed
                if selectedPageId == page.id {
                    if pages.isEmpty {
                        selectedPageId = nil
                    } else {
                        let newIndex = min(index, pages.count - 1)
                        selectedPageId = pages[newIndex].id
                    }
                }
            }
        }
    }
}

struct ThumbnailView: View {
    let page: PageModel
    let isSelected: Bool
    let onDelete: () -> Void
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: page.image)
                .resizable()
                .scaledToFill()
                .frame(width: 90, height: 130)
                .clipped()
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 3)
                )
                .shadow(radius: 2)
            
            Button(action: onDelete) {
                Image(systemName: "minus.circle.fill")
                    .foregroundColor(.white)
                    .background(Circle().fill(Color.red))
            }
            .offset(x: 8, y: -8)
        }
        .padding([.top, .trailing], 8)
    }
}

struct PageDropDelegate: DropDelegate {
    let item: PageModel
    @Binding var items: [PageModel]
    @Binding var draggedItem: PageModel?

    func performDrop(info: DropInfo) -> Bool {
        draggedItem = nil
        return true
    }

    func dropEntered(info: DropInfo) {
        guard let draggedItem = self.draggedItem else {
            return
        }
        
        if draggedItem != item {
            if let from = items.firstIndex(of: draggedItem),
               let to = items.firstIndex(of: item) {
                withAnimation {
                    items.move(fromOffsets: IndexSet(integer: from), toOffset: to > from ? to + 1 : to)
                }
            }
        }
    }
}
