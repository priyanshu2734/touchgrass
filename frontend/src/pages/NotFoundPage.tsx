import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-page py-24">
      <EmptyState
        icon={Compass}
        title="That page is off the map"
        description="The link may be old or mistyped. Head back to the start or plan something outside."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink to="/" variant="primary">
              Go to the home page
            </ButtonLink>
            <ButtonLink to="/plan" variant="secondary">
              Plan my next adventure
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
