#!/bin/bash

# Script to sync all local git worktrees by merging all branches together
# Each worktree will contain all changes from all other worktrees

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run]"
            echo ""
            echo "Sync all git worktrees by merging all branches together."
            echo "Each worktree will end up with all changes from all other worktrees."
            echo ""
            echo "Options:"
            echo "  --dry-run    Preview what would be merged without making changes"
            echo "  --help, -h   Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🔄 Git Worktree Multi-Way Sync${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Get current directory
CURRENT_DIR=$(pwd)

# Get list of all worktrees
WORKTREES=()
BRANCHES=()
PATHS=()

echo -e "${BLUE}📊 Analyzing worktrees...${NC}"
while IFS= read -r line; do
    WORKTREE_PATH=$(echo "$line" | awk '{print $1}')
    BRANCH=$(echo "$line" | awk '{print $3}' | tr -d '[]')
    
    WORKTREES+=("$line")
    BRANCHES+=("$BRANCH")
    PATHS+=("$WORKTREE_PATH")
    
    echo "  📁 $WORKTREE_PATH (branch: $BRANCH)"
done < <(git worktree list)

echo ""
echo -e "${BLUE}🔍 Pre-flight checks...${NC}"

# Check for uncommitted changes in all worktrees
ALL_CLEAN=true
for i in "${!PATHS[@]}"; do
    cd "${PATHS[$i]}" || continue
    
    if [[ -n $(git status --porcelain) ]]; then
        echo -e "${RED}❌ Worktree has uncommitted changes: ${PATHS[$i]}${NC}"
        ALL_CLEAN=false
    else
        echo -e "${GREEN}✓ Clean: ${PATHS[$i]}${NC}"
    fi
done

if [ "$ALL_CLEAN" = false ]; then
    echo ""
    echo -e "${RED}⚠️  Cannot proceed: Some worktrees have uncommitted changes${NC}"
    echo "Please commit or stash changes in all worktrees before syncing."
    exit 1
fi

# Return to original directory
cd "$CURRENT_DIR"

echo ""
echo -e "${YELLOW}⚠️  Warning: This will merge all branches into each other!${NC}"
echo "Each worktree will receive changes from all other worktrees."
echo ""

if [ "$DRY_RUN" = false ]; then
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}🔄 Starting multi-way merge...${NC}"

# Create backup tags
if [ "$DRY_RUN" = false ]; then
    echo ""
    echo -e "${BLUE}🏷️  Creating backup tags...${NC}"
    BACKUP_PREFIX="backup-before-sync-$(date +%Y%m%d-%H%M%S)"
    
    for i in "${!PATHS[@]}"; do
        cd "${PATHS[$i]}" || continue
        TAG_NAME="${BACKUP_PREFIX}-${BRANCHES[$i]}"
        git tag "$TAG_NAME" 2>/dev/null || true
        echo "  Created tag: $TAG_NAME"
    done
fi

# For each worktree, merge all other branches
MERGE_FAILED=false
for i in "${!PATHS[@]}"; do
    echo ""
    echo -e "${BLUE}📁 Processing worktree: ${PATHS[$i]}${NC}"
    echo -e "${BLUE}🌿 Current branch: ${BRANCHES[$i]}${NC}"
    
    cd "${PATHS[$i]}" || continue
    
    # Add all other worktrees as temporary remotes and fetch
    for j in "${!PATHS[@]}"; do
        if [ $i -eq $j ]; then
            continue  # Skip self
        fi
        
        REMOTE_NAME="worktree-$(echo "${PATHS[$j]}" | md5sum | cut -c1-8)"
        OTHER_BRANCH="${BRANCHES[$j]}"
        
        # Remove existing remote if it exists
        git remote remove "$REMOTE_NAME" 2>/dev/null || true
        
        # Add as remote
        git remote add "$REMOTE_NAME" "${PATHS[$j]}"
        
        # Fetch from this worktree
        echo -e "  ${YELLOW}📥 Fetching from ${OTHER_BRANCH}...${NC}"
        git fetch "$REMOTE_NAME" "$OTHER_BRANCH" 2>/dev/null || true
        
        # Merge the branch
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${YELLOW}🔍 Would merge: ${OTHER_BRANCH}${NC}"
            # Show what would be merged
            git log --oneline --graph --decorate "${BRANCHES[$i]}..${REMOTE_NAME}/${OTHER_BRANCH}" 2>/dev/null | head -10 || true
        else
            echo -e "  ${YELLOW}🔀 Merging ${OTHER_BRANCH}...${NC}"
            if git merge "${REMOTE_NAME}/${OTHER_BRANCH}" -m "Sync merge from ${OTHER_BRANCH}" --no-edit; then
                echo -e "  ${GREEN}✓ Successfully merged ${OTHER_BRANCH}${NC}"
            else
                echo -e "  ${RED}❌ Merge conflict with ${OTHER_BRANCH}!${NC}"
                echo -e "  ${RED}Please resolve conflicts manually and run the script again.${NC}"
                MERGE_FAILED=true
                
                # Clean up remote
                git remote remove "$REMOTE_NAME" 2>/dev/null || true
                break
            fi
        fi
        
        # Clean up remote
        git remote remove "$REMOTE_NAME" 2>/dev/null || true
    done
    
    if [ "$MERGE_FAILED" = true ]; then
        break
    fi
done

# Return to original directory
cd "$CURRENT_DIR"

echo ""
if [ "$MERGE_FAILED" = true ]; then
    echo -e "${RED}❌ Sync failed due to merge conflicts${NC}"
    echo ""
    echo -e "${YELLOW}To resolve:${NC}"
    echo "1. Go to the worktree with conflicts"
    echo "2. Resolve the conflicts manually"
    echo "3. Commit the merge"
    echo "4. Run this script again to continue syncing"
    echo ""
    echo -e "${YELLOW}To abort and restore:${NC}"
    echo "Use the backup tags created with prefix: ${BACKUP_PREFIX}"
    exit 1
elif [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}✨ Dry run complete!${NC}"
    echo "No changes were made. Remove --dry-run to perform actual merge."
else
    echo -e "${GREEN}✨ Sync complete!${NC}"
    echo ""
    echo -e "${BLUE}All worktrees now contain changes from all branches.${NC}"
    echo ""
    echo -e "${YELLOW}Backup tags were created with prefix: ${BACKUP_PREFIX}${NC}"
    echo "To restore a worktree to its previous state:"
    echo "  cd <worktree-path>"
    echo "  git reset --hard <backup-tag-name>"
fi