import { useEffect } from 'react';
import { App, Scope } from 'obsidian';

/**
 * Uses Obsidian's native Scope API to trap the ESC key.
 * This pushes a new keymap scope onto the stack, ensuring our handler
 * takes precedence over Obsidian's default "Close Leaf" action.
 *
 * @param app The Obsidian App instance
 * @param onAction The cleanup/close function to run
 * @param isActive Whether the modal/drawer is currently open
 */
export const useEscapeKey = (app: App, onAction: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;

    // 1. Create a new Scope (inheriting from global scope is optional but good practice)
    const scope = new Scope(app.scope);

    // 2. Register 'Escape' key with no modifiers ([])
    scope.register([], 'Escape', (event: KeyboardEvent) => {
      // Prevent default browser behavior
      event.preventDefault(); 
      
      // Execute our close logic
      onAction();

      // Return false to tell Obsidian "I handled this, stop processing"
      return false; 
    });

    // 3. Push our scope to the top of the stack
    app.keymap.pushScope(scope);

    // 4. Cleanup: Remove scope when component unmounts or closes
    return () => {
      app.keymap.popScope(scope);
    };
  }, [app, onAction, isActive]);
};
