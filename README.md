# BIT Focus

BIT Focus is really just a side-project, intended to become a simple productivity tracking solution.

## Installation

Follow these steps to set up the project locally:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/BrazeDaGreat/bit-focus.git
   cd bit-focus
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   This will launch the application at `http://localhost:3000`.

## Usage

- **Adding Tasks:** Navigate to the "Tasks" section to add new tasks, define subtasks, set due dates, and assign tags.
- **Starting Focus Sessions:** In the "Focus" section, initiate a new focus session by specifying a tag and the start time. End the session when completed to log it.
- **Configuring Settings:** Access the "Configuration" section to set your name and choose a theme that suits your preference.

## Project Structure

- **`components/`**: Contains reusable React components.
- **`hooks/`**: Custom hooks for state management and data fetching.
- **`pages/`**: Next.js pages that define the application's routes.
- **`public/`**: Static assets like images and icons.

## Technologies Used

- **Next.js:** Framework for server-rendered React applications.
- **React Hook Form:** For form management and validation.
- **Zustand:** Lightweight state management library.
- **Dexie.js:** Wrapper for IndexedDB to handle client-side data storage.
- **shadcn/ui:** Component library for building accessible web interfaces.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.

## Acknowledgements

- [React Hook Form](https://react-hook-form.com/) for efficient form handling.
- [Zustand](https://github.com/pmndrs/zustand) for simplified state management.
- [Dexie.js](https://dexie.org/) for seamless IndexedDB interactions.
- [shadcn/ui](https://shadcn.dev/) for a robust component library.