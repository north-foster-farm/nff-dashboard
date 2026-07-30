# Pasture rotation planner — requirements

James's requirements dump, 2026-05-05, verbatim. The planner is still
unbuilt (it descends from the old Batch 37). Extracted from
`.ignored/pasture-rotation.md`, which continued into a chores
interaction-model section that the chores rebuild has since
superseded; only the pasture material is kept here.

more feature requirements for the pasture rotation planner:

- file handling needs to be implemented, and users should be able to upload a
GeoJSON file directly via the admin dashboard to add new pastures to the planner
  - our first pasture GeoJSON is located here: /Users/james/Downloads/Pastures.geojson
- the planner has preferences that are set globally (i.e. shared by me and my
dad), but can be overriden in a plan if desired. global preferences include:
    - Suscovich tractor
        - footprint dimensions
        - max number of birds
    - Salatin tractor
        - footprint dimensions
        - max number of birds
    - Rotation options
        - allow right angle moves? (can tractors turn 90 degrees or do they need
        to make U-turns?)
        - minimum pasture recovery time (how soon can more chickens occupy some
        pasture after a tractor was on it?)
- when planning, these preferences should appear pre-filled with the set values.
other fields should be present, such as: number of birds in batch (auto-suggests
how many tractors and which kinds to use based on that); start date; pastured
duration.
- tractors should be able to be placed on the pasture geoJSON data. then, the
tractors should be able to be moved to another location in the pasture. the app
should calculate how many moves it will take to get there. it should suggest
keeping the other tractors close to the one that was moved manually and suggest
placement. the idea is to have fine-grained control over where in the field
tractors are moved, and the app makes it easy to build an efficient plan.

 - Pasture rotation variables
     - Min number of tractors
       - How many per
    - Max per tractor (Salatin says 70)
    - Our max per tractor is 50
        - 50 per each salatin and 25 in sukovitch
    - 10' x 12'
